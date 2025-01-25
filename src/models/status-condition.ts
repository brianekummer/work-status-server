/**
 * Status Condition
 * 
 * 
 */
export class StatusCondition {
    public conditions_work_emoji: string;
    public conditions_work_presence: string;
    public conditions_home_emoji: string;
    public conditions_home_presence: string;
    public display_emoji_image: string;
    public display_text: string;

    // Constructors
    constructor(conditions_work_emoji: string, conditions_work_presence: string, conditions_home_emoji: string, conditions_home_presence: string, display_emoji_image: string, display_text: string) {
      this.conditions_work_emoji = conditions_work_emoji;
      this.conditions_work_presence = conditions_work_presence;
      this.conditions_home_emoji = conditions_home_emoji;
      this.conditions_home_presence = conditions_home_presence;
      this.display_emoji_image = display_emoji_image;
      this.display_text = display_text;
    }
  }