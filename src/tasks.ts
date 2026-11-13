interface Task {
  id: number;
  title: string;
  done: boolean;
  deadline?: string;
}

const tasks: Task[] = [
  { id: 1, title: "Растяжка", done: true, deadline: "11.11" },
  { id: 2, title: "Силовая тренировка", done: false, deadline: "17.11" },
  { id: 3, title: "Функциональная тренировка", done: false, deadline: "19.11" },
];

console.log(tasks);