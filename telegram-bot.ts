//Телеграм-бот: погода в Алматы и курсы валют. Команды, кнопки и обычные слова показывают работу Promise
//запуск: npm run bot  (токен берется из файла .env)

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!TOKEN) {
    console.error("Не найден TELEGRAM_BOT_TOKEN. Создай файл .env (пример в .env.example)");
    process.exit(1);
}
const API = `https://api.telegram.org/bot${TOKEN}`;

interface Weather {
    current: {
        time: string;
        temperature_2m: number;
        wind_speed_10m: number;
    };
}

interface Rates {
    base_code: string;
    rates: Record<string, number>;
}

interface TgResponse<T> {
    ok: boolean;
    result: T;
    description?: string;
}

interface Update {
    update_id: number;
    //обычное сообщение
    message?: { chat: { id: number }; text?: string };
    //нажатие на кнопку под сообщением
    callback_query?: { id: string; data?: string; message?: { chat: { id: number } } };
}

//ответ бота: текст и нужно ли прикрепить кнопки
interface Reply {
    text: string;
    withButtons?: boolean;
}

//---------- погода и курсы (то же самое, что в weather-currency.ts) ----------

async function getWeather(): Promise<Weather> {
    const url =
        "https://api.open-meteo.com/v1/forecast?latitude=43.24&longitude=76.89&current=temperature_2m,wind_speed_10m";
    const response = await fetch(url);
    const data: Weather = await response.json();
    return data;
}

interface UsdEurRates {
    usd: Rates;
    eur: Rates;
}

async function getRates(base: string): Promise<Rates> {
    const response = await fetch(`https://open.er-api.com/v6/latest/${base}`);
    const data: Rates = await response.json();
    //если сервис ответил ошибкой, курсов в ответе не будет - кидаем ошибку
    if (!response.ok || !data.rates) {
        throw new Error(`open.er-api.com не вернул курсы для ${base}`);
    }
    return data;
}

//второй источник курсов (другой сервис, нужен для Promise.any)
async function getRatesBackup(base: string): Promise<Rates> {
    const lower = base.toLowerCase();
    const response = await fetch(
        `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${lower}.json`,
    );
    const data = (await response.json()) as Record<string, Record<string, number> | undefined>;
    const table = data[lower];
    if (!response.ok || !table) {
        throw new Error(`currency-api не вернул курсы для ${base}`);
    }
    //у этого сервиса коды валют в нижнем регистре (kzt), приводим к привычному виду (KZT)
    const rates: Record<string, number> = {};
    for (const [code, value] of Object.entries(table)) {
        rates[code.toUpperCase()] = value;
    }
    return { base_code: base, rates };
}

//последние удачно полученные курсы (используем, когда сервис недоступен)
let lastRates: UsdEurRates | undefined;

//нужны оба курса сразу, поэтому Promise.all
async function getUsdEurRates(): Promise<UsdEurRates> {
    const [usd, eur] = await Promise.all([getRates("USD"), getRates("EUR")]);
    lastRates = { usd, eur };
    return lastRates;
}

async function getUsdEurRatesBackup(): Promise<UsdEurRates> {
    const [usd, eur] = await Promise.all([getRatesBackup("USD"), getRatesBackup("EUR")]);
    return { usd, eur };
}

//курсы из памяти: если они есть - уже выполненный промис (resolve), если нет - уже отклоненный (reject)
function cachedRates(): Promise<UsdEurRates> {
    return lastRates ? Promise.resolve(lastRates) : Promise.reject(new Error("в кеше пусто"));
}

//ограничение по времени: промис-таймер собираем через withResolvers,
//race выбирает, кто завершится первым - запрос или таймер
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    const timer = Promise.withResolvers<never>();
    const id = setTimeout(() => timer.reject(new Error("timeout")), ms);
    return Promise.race([promise, timer.promise]).finally(() => clearTimeout(id));
}

//достаем курс валюты, а если ее нет в ответе - кидаем ошибку
function rate(data: Rates, code: string): number {
    const value = data.rates[code];
    if (value === undefined) {
        throw new Error(`Нет курса ${code}`);
    }
    return value;
}

//превращаем данные в текст для сообщения
function formatWeather(weather: Weather): string {
    const { temperature_2m, wind_speed_10m } = weather.current;
    return `В Алматы сейчас ${temperature_2m} °C\nВетер ${wind_speed_10m} км/ч`;
}

function formatRates({ usd, eur }: UsdEurRates): string {
    const usdKzt = rate(usd, "KZT");
    const eurKzt = rate(eur, "KZT");
    return [
        `Курс USD к KZT: ${usdKzt.toFixed(2)}`,
        `Курс EUR к KZT: ${eurKzt.toFixed(2)}`,
        `Курс CNY к KZT: ${(usdKzt / rate(usd, "CNY")).toFixed(2)}`,
        `Кросс-курс EUR/USD через KZT: ${(eurKzt / usdKzt).toFixed(4)}`,
    ].join("\n");
}

const WEATHER_FAILED = "Не удалось получить погоду";
const RATES_FAILED = "Не удалось получить курс валют";

//команда /weather - только погода (ждем не дольше 5 секунд)
async function weatherReport(): Promise<string> {
    try {
        return formatWeather(await withTimeout(getWeather(), 5000));
    } catch (error) {
        if (error instanceof Error && error.message === "timeout") {
            return "Сервис погоды отвечает слишком долго, попробуйте позже";
        }
        return WEATHER_FAILED;
    }
}

//команда /rates - только курсы валют, а если сервис упал - последние сохраненные
async function ratesReport(): Promise<string> {
    try {
        let fromCache = false;
        const data = await getUsdEurRates().catch(() => {
            fromCache = true;
            return cachedRates();
        });
        return formatRates(data) + (fromCache ? "\n\n(сервис недоступен, показаны сохраненные курсы)" : "");
    } catch {
        return RATES_FAILED;
    }
}

//команда /all - Promise.all: ждем оба запроса, а если упал хотя бы один - не получаем ничего
async function allReport(): Promise<string> {
    try {
        const [weather, rates] = await Promise.all([getWeather(), getUsdEurRates()]);
        return `${formatWeather(weather)}\n\n${formatRates(rates)}\n\nPromise.all: оба запроса выполнены`;
    } catch {
        return "Promise.all отклонен: один из запросов не удался, поэтому результата нет";
    }
}

//команда /settled - Promise.allSettled: ждем оба запроса, даже если один из них упал
async function settledReport(): Promise<string> {
    const [weatherResult, currencyResult] = await Promise.allSettled([getWeather(), getUsdEurRates()]);
    const weatherText = weatherResult.status === "fulfilled" ? formatWeather(weatherResult.value) : WEATHER_FAILED;

    let ratesText = RATES_FAILED;
    if (currencyResult.status === "fulfilled") {
        try {
            ratesText = formatRates(currencyResult.value);
        } catch {
            //в ответе не оказалось нужной валюты - оставляем сообщение об ошибке
        }
    }

    const statuses = `Promise.allSettled: погода - ${weatherResult.status}, курсы - ${currencyResult.status}`;
    return `${weatherText}\n\n${ratesText}\n\n${statuses}`;
}

//команда /race - Promise.race: погода и курсы бегут наперегонки, показываем того, кто пришел первым
async function raceReport(): Promise<string> {
    const started = Date.now();
    try {
        const winner = await Promise.race([
            getWeather().then((weather) => ({ who: "первой ответила погода", text: formatWeather(weather) })),
            getUsdEurRates().then((rates) => ({ who: "первыми ответили курсы", text: formatRates(rates) })),
        ]);
        return `${winner.text}\n\nPromise.race: ${winner.who} (${Date.now() - started} мс)`;
    } catch {
        return "Promise.race: первым завершился запрос с ошибкой";
    }
}

//команда /any - Promise.any: курсы из двух источников, берем первый удачный ответ
async function anyReport(): Promise<string> {
    try {
        const winner = await Promise.any([
            getUsdEurRates().then((data) => ({ data, source: "open.er-api.com" })),
            getUsdEurRatesBackup().then((data) => ({ data, source: "currency-api" })),
        ]);
        lastRates = winner.data;
        return `${formatRates(winner.data)}\n\nPromise.any: быстрее ответил ${winner.source}`;
    } catch (error) {
        //AggregateError значит, что отклонились оба источника
        return error instanceof AggregateError ? "Promise.any: оба источника курсов недоступны" : RATES_FAILED;
    }
}

//команда /chain - цепочка then / catch / finally, внизу показываем какие шаги сработали
async function chainReport(): Promise<string> {
    const steps: string[] = [];
    const text = await getWeather()
        .then((weather) => {
            steps.push("then: данные получены");
            return formatWeather(weather);
        })
        .catch(() => {
            steps.push("catch: запрос завершился ошибкой");
            return WEATHER_FAILED;
        })
        .finally(() => {
            steps.push("finally: запрос завершен");
        });
    return `${text}\n\nЦепочка:\n${steps.join("\n")}`;
}

//---------- телеграм ----------

async function tg<T>(method: string, body: object): Promise<T> {
    const response = await fetch(`${API}/${method}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    const data = (await response.json()) as TgResponse<T>;
    if (!data.ok) {
        throw new Error(`Telegram ${method}: ${data.description}`);
    }
    return data.result;
}

const GREETING =
    "Я показываю погоду и курсы валют.\n\n" +
    "/weather — погода\n" +
    "/rates — курсы валют\n" +
    "/all — Promise.all\n" +
    "/settled — Promise.allSettled\n" +
    "/race — Promise.race\n" +
    "/any — Promise.any\n" +
    "/chain — then/catch/finally\n\n" +
    "Можно и без команд написать: «погода», «курс доллара», «всё сразу» или нажать кнопку.";

//это список команд для выпадающего меню (кнопка "Меню" слева от поля ввода)
const COMMANDS = [
    { command: "weather", description: "Погода в Алматы" },
    { command: "rates", description: "Курсы валют к тенге" },
    { command: "all", description: "Promise.all" },
    { command: "settled", description: "Promise.allSettled" },
    { command: "race", description: "Promise.race" },
    { command: "any", description: "Promise.any" },
    { command: "chain", description: "then/catch/finally" },
];

//кнопки под приветствием. callback_data - то, что придет боту при нажатии (та же команда)
const KEYBOARD = {
    inline_keyboard: [
        [
            { text: "⛅ Погода", callback_data: "/weather" },
            { text: "💱 Курсы", callback_data: "/rates" },
        ],
        [
            { text: "👥 Promise.all", callback_data: "/all" },
            { text: "📋 allSettled", callback_data: "/settled" },
        ],
        [
            { text: "🏁 Promise.race", callback_data: "/race" },
            { text: "🥇 Promise.any", callback_data: "/any" },
        ],
        [{ text: "🔗 then/catch/finally", callback_data: "/chain" }],
    ],
};

//превращаем текст пользователя в команду: "погода" -> "/weather", "курс доллара" -> "/rates"
//"/weather@имя_бота" в группах приводим к "/weather"
function resolveCommand(input: string): string {
    const text = input.trim().toLowerCase();
    if (text.startsWith("/")) return text.split(/[\s@]/)[0] ?? "";
    if (text.includes("всё сразу") || text.includes("все сразу")) return "/all";
    if (text.includes("погод")) return "/weather";
    if (text.includes("курс") || text.includes("доллар")) return "/rates";
    return "";
}

//выбираем ответ по команде
async function reply(input: string): Promise<Reply> {
    switch (resolveCommand(input)) {
        case "/weather":
            return { text: await weatherReport() };
        case "/rates":
            return { text: await ratesReport() };
        case "/all":
            return { text: await allReport() };
        case "/settled":
            return { text: await settledReport() };
        case "/race":
            return { text: await raceReport() };
        case "/any":
            return { text: await anyReport() };
        case "/chain":
            return { text: await chainReport() };
        default:
            return { text: GREETING, withButtons: true };
    }
}

async function main() {
    const me = await tg<{ username: string }>("getMe", {});
    //регистрируем меню команд в Телеграме
    await tg("setMyCommands", { commands: COMMANDS });
    console.log(`Бот @${me.username} запущен`);

    //offset - номер сообщения, с которого читать дальше (чтобы не получать одно и то же)
    let offset = 0;

    while (true) {
        try {
            //long polling: Телеграм держит запрос до 30 секунд и отвечает, когда появилось сообщение
            const updates = await tg<Update[]>("getUpdates", {
                offset,
                timeout: 30,
                allowed_updates: ["message", "callback_query"],
            });

            for (const update of updates) {
                offset = update.update_id + 1;

                //запрос приходит либо как сообщение, либо как нажатие на кнопку
                const query = update.callback_query;
                const incoming = update.message?.text ?? query?.data;
                const chatId = update.message?.chat.id ?? query?.message?.chat.id;

                //сообщаем Телеграму, что нажатие получено (иначе на кнопке крутятся "часики")
                if (query) {
                    await tg("answerCallbackQuery", { callback_query_id: query.id });
                }
                if (!incoming || chatId === undefined) continue;

                //Promise.try: любая ошибка в обработчике (даже синхронная) станет отклоненным промисом,
                //и вместо падения бот ответит, что что-то пошло не так
                const answer = await Promise.try(() => reply(incoming)).catch(
                    (): Reply => ({ text: "Что-то пошло не так, попробуйте еще раз" }),
                );
                await tg("sendMessage", {
                    chat_id: chatId,
                    text: answer.text,
                    ...(answer.withButtons ? { reply_markup: KEYBOARD } : {}),
                });
            }
        } catch (error) {
            console.error("Ошибка:", error instanceof Error ? error.message : error);
            //небольшая пауза, чтобы не долбить сервер при сбое сети
            await new Promise((resolve) => setTimeout(resolve, 5000));
        }
    }
}

main();
