export interface Example {
  icon: string;
  displayText: string;
  messageText: string;
}

export const DEFAULT_EXAMPLES: Example[] = [
  {
    icon: "🌍",
    displayText: "Where am I and what time is it?",
    messageText: "Where am I and what time is it?",
  },
  {
    icon: "👋",
    displayText: "Say hello",
    messageText: "Say hello",
  },
  {
    icon: "🔢",
    displayText: "Solve a math problem",
    messageText: "What is 123 plus 15% of 200 all divided by 7?",
  },
  {
    icon: "😴",
    displayText: "Sleep for 3 seconds",
    messageText: "Sleep for 3 seconds",
  },
  {
    icon: "🎲",
    displayText: "Generate a random number",
    messageText: "Generate a random number between 1 and 100.",
  },
  {
    icon: "📹",
    displayText: "Play a video",
    messageText:
      'Open the following webpage: "https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1".',
  },
];
