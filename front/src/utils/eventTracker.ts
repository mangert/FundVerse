export class EventTracker {
  private static instance: EventTracker;
  private processedEvents: Set<string>;
  private readonly storageKey = 'processed-platform-events';

  private constructor() {
    const stored = localStorage.getItem(this.storageKey);
    this.processedEvents = new Set(stored ? JSON.parse(stored) : []);
  }

  public static getInstance(): EventTracker {
    if (!EventTracker.instance) {
      EventTracker.instance = new EventTracker();
    }
    return EventTracker.instance;
  }

  public isProcessed(eventId: string): boolean {
    return this.processedEvents.has(eventId);
  }

  public markAsProcessed(eventId: string): void {
    this.processedEvents.add(eventId);
    this.saveToStorage();
  }

  public cleanupOldEvents(maxAgeHours: number = 1): void {
    const now = Date.now();
    const newSet = new Set<string>();
    
    this.processedEvents.forEach(eventId => {
      const parts = eventId.split('-');
      const timestamp = parts.length > 2 ? parseInt(parts[2]) : 0;
      
      if (now - timestamp < maxAgeHours * 60 * 60 * 1000) {
        newSet.add(eventId);
      }
    });
    
    this.processedEvents = newSet;
    this.saveToStorage();
  }

  private saveToStorage(): void {
    const array = Array.from(this.processedEvents);
    const limitedArray = array.slice(-200); // Ограничиваем размер
    localStorage.setItem(this.storageKey, JSON.stringify(limitedArray));
  }
}