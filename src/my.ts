function calories(minutes: number, perMinute: number): number {
  return minutes * perMinute;
}
function workoutInfo(name: string, minutes: number): string {
  return `Привет, ${name}! Ты занимался ${minutes} минут.`;
}

console.log(workoutInfo("Друг", 45));
console.log(calories(45, 8));