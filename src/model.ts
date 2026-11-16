// будущее приложение для тренировок с аватаром, геймификацией и баллами

interface Avatar {
  // Имя аватара
  name: string;
  // Желаемый вид тела: можно выбрать только один из трёх вариантов пока
  bodyGoal: "slim" | "athletic" | "muscular";
  // Уровень аватара — число, растёт по мере тренировок
  level: number;
}

// Описываем одну тренировку
interface Workout {
  // Уникальный номер тренировки
  id: number;
  // Название тренировки: любой текст
  title: string;
  // только один из трёх вариантов видов тренировок
  kind: "stretch" | "strength" | "functional";
  // Сколько минут длилась тренировка
  minutes: number;
  // Выполнена тренировка или нет (да/нет)
  done: boolean;
  // Сколько баллов даёт эта тренировка
  points: number;
}

// Создаём аватар: имя, желаемый вид тела и стартовый уровень 1
const avatar: Avatar = { name: "Алекс", bodyGoal: "athletic", level: 1 };

// Список тренировок с данными
const workouts: Workout[] = [
  // Растяжка: 20 минут, выполнена, дала 20 баллов
  { id: 1, title: "Растяжка", kind: "stretch", minutes: 20, done: true, points: 20 },
  // Силовая: 45 минут, выполнена, дала 60 баллов
  { id: 2, title: "Силовая тренировка", kind: "strength", minutes: 45, done: true, points: 60 },
  // Функциональная: 40 минут, ещё не выполнена, баллы пока не засчитываются
  { id: 3, title: "Функциональная тренировка", kind: "functional", minutes: 40, done: false, points: 50 },
];

// Функция принимает список тренировок и возвращает сумму баллов за выполненные
function earnedPoints(list: Workout[]): number {
  // Копилка баллов, в начале она пустая
  let sum = 0;
  // Берём тренировки из списка по одной
  for (const w of list) {
    // Если тренировка выполнена, считаем её баллы
    if (w.done) {
      // Добавляем баллы этой тренировки в копилку
      sum = sum + w.points;
    }
  }
  // Отдаём итоговую сумму наружу
  return sum;
}

// Невыполненные тренировки
function notDone(list: Workout[]): Workout[] {
  // Оставляем в списке только тренировки, где done равно false
  return list.filter((w) => !w.done);
}

// Вызываем функцию на нашем списке и сохраняем результат
const points = earnedPoints(workouts);

// Находим невыполненные тренировки в нашем списке
const left = notDone(workouts);

// Выводим аватара в консоль
console.log(avatar);
// Выводим, сколько баллов заработано
console.log(`Баллов заработано: ${points}`);
// Выводим названия тренировок, которые ещё осталось сделать
console.log(left.map((w) => w.title));
