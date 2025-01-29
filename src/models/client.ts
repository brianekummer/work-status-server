import { Response } from 'express';

/**
 * Status for Client
 * 
 * 
 */
export class Client {
  public ipAddress: string;
  public pageName: string;  
  public response: Response;
  public emoji: string;
  public emojiImage: string;

  // Constructors
  constructor(ipAddress: string, pageName: string, response: Response, emoji: string, emojiImage: string) {
    this.ipAddress = ipAddress;
    this.pageName = pageName;
    this.response = response;
    this.emoji = emoji;
    this.emojiImage = emojiImage;
  }
}