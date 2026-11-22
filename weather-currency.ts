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
async function getRates(): Promise<Rates> {
    //адрес куда отрправлен запрос
    const url = "https://open.er-api.com/v6/latest/USD";
    //ожидаем пока ответят
    const response = await fetch(url);
    //мы получили данные, но его нужно распаковать в json
    const data: Rates = await response.json();
    //console.log(data);
    return data;
    // возращает обещание 
}
//основная функция запускающая все выше написанное
async function main() {
    const [weather, currency] = await Promise.all([getWeather(), getRates()]);
    //просим одновременно и погоду и курс валют и снова ждем изза await

    //нам нужны именно эти валюты
    const kzt = currency.rates.KZT;
    const eur = currency.rates.EUR;
    const cny = currency.rates.CNY;


    console.log(`В Алматы сейчас ${weather.current.temperature_2m} °C`);
    //печатаем как нам нужно чтобы выдавал шаблонно ответ и данные с weather
    console.log(`Курс USD к KZT: ${currency.rates.KZT.toFixed(2)}`);
    //печатаем как нам нужно чтобы выдавал шаблонно ответ и данные с currency по всем трем валютам
    console.log(`Курс EUR к KZT: ${(currency.rates.KZT / currency.rates.EUR).toFixed(2)}`);
    console.log(`Курс CNY к KZT: ${(currency.rates.KZT / currency.rates.CNY).toFixed(2)}`);
}


main();
// вызывает главную фунцкию main которая запускает весь выше указанный код и ждем выполнения


