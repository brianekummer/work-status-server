import { Response } from 'express';

/**
 * Client
 * 
 * Defines a client or web browser that connects to this application and needs
 * status data sent back to it.
 */
export default class Client {

  constructor(
    public readonly ipAddress: string,
    public readonly pageName: string,
    public readonly response: Response,
    public emoji: string = '',
    public emojiImage: string = '') {}
}