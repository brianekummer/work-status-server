/**
 * Status Condition
 * 
 * Defines a status condition, which is a row from status-conditions.csv.
 * This is used in the process of deciding what the next status should be.
 */
export default class StatusCondition {

  constructor(
    public readonly conditionsWorkEmoji: string, 
    public readonly conditionsWorkPresence: string,
    public readonly conditionsHomeEmoji: string, 
    public readonly conditionsHomePresence: string, 
    public readonly displayEmojiImage: string, 
    public readonly displayText: string) {}
}