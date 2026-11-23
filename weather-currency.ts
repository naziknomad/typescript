//ДЗ 18.11 - отображать погоду и курс валют одновременно

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

async function getWeather(): Promise<Weather> {
    const url =
        "https://api.open-meteo.com/v1/forecast?latitude=43.24&longitude=76.89&current=temperature_2m,wind_speed_10m";
    const response = await fetch(url);
    //console.log(response);
    const data: Weather = await response.json();
    //console.log(data);
    return data;
}

//отправляем запрос на получение курса валют (придет не сразу)
async function getRates(base: string = "USD"): Promise<Rates> {
    //адрес куда отрправлен запрос (base - валюта, относительно которой даны курсы)
    const url = `https://open.er-api.com/v6/latest/${base}`;
    //ожидаем пока ответят
    const response = await fetch(url);
    //мы получили данные, но его нужно распаковать в json
    const data: Rates = await response.json();
    //console.log(data);
    return data;
    // возращает обещание 
}
//просим курсы относительно USD и относительно EUR одновременно
//здесь нужен именно Promise.all: без обоих курсов кросс-курс не посчитать
async function getUsdEurRates(): Promise<{ usd: Rates; eur: Rates }> {
    const [usd, eur] = await Promise.all([getRates("USD"), getRates("EUR")]);
    return { usd, eur };
}

//основная функция запускающая все выше написанное
async function main() {
    const [weatherResult, currencyResult] = await Promise.allSettled([getWeather(), getUsdEurRates()]);
    //просим одновременно и погоду и курс валют и снова ждем изза await
    //allSettled ждет оба запроса и не падает, даже если один из них завершился ошибкой

    console.log(weatherResult);
    console.log(currencyResult);
    //печатаем результат в консоль, чтобы увидеть что пришло

    //проверяем каждый результат отдельно: fulfilled - успех (value), rejected - ошибка (reason)
    if (weatherResult.status === "fulfilled") {
        const weather = weatherResult.value;
        console.log(`В Алматы сейчас ${weather.current.temperature_2m} °C`);
        //печатаем как нам нужно чтобы выдавал шаблонно ответ и данные с weather
    } else {
        console.log("Не удалось получить погоду:", weatherResult.reason);
    }

    if (currencyResult.status === "fulfilled") {
        const { usd, eur } = currencyResult.value;
        const usdKzt = usd.rates.KZT;
        const eurKzt = eur.rates.KZT;
        const usdCny = usd.rates.CNY;
        //курса может не оказаться в ответе - тогда дальше считать нельзя
        if (usdKzt === undefined || eurKzt === undefined || usdCny === undefined) {
            console.log("В ответе нет нужных валют");
            return;
        }
        console.log(`Курс USD к KZT: ${usdKzt.toFixed(2)}`);
        //печатаем как нам нужно чтобы выдавал шаблонно ответ и данные с currency по всем трем валютам
        console.log(`Курс EUR к KZT: ${eurKzt.toFixed(2)}`);
        console.log(`Курс CNY к KZT: ${(usdKzt / usdCny).toFixed(2)}`);
        //кросс-курс EUR/USD через тенге: сколько долларов стоит один евро
        console.log(`Кросс-курс EUR/USD через KZT: ${(eurKzt / usdKzt).toFixed(4)}`);
    } else {
        console.log("Не удалось получить курс валют:", currencyResult.reason);
    }
}

console.log("старт");
main();
// вызывает главную фунцкию main которая запускает весь выше указанный код и ждем выполнения
console.log("конец");


