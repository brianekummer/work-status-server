import { globSync } from 'glob';
import path from 'path';
import { PAGES } from '../constants';


type EmojiImagesDictionary = Map<string, string[]>;


/**
 * Emoji Service
 * 
 */
export class EmojiService {
  private emojiImages: EmojiImagesDictionary;

    
  constructor() {
    this.emojiImages = this.buildListOfEmojiImages()
  }
  

  /**
   * Explain how am doing this
   */
  private buildListOfEmojiImages(): EmojiImagesDictionary {
    const dirname = '../public/images';

    // Build a unique list of emojis by stripping trailing digits and underscores from filenames
    const filenames = globSync(`${dirname}/*`);
    const emojis = Array.from(new Set(
      filenames.map(f =>
        path.basename(f, path.extname(f)).replace(/_\d+$/, '')
      )
    ));

    // Create a map of emoji to their corresponding images
    const emojiImages: EmojiImagesDictionary = new Map<string, string[]>();
    emojis.forEach(e => {
      const images = 
        globSync(`${dirname}/${e}*`)
        .map(i => `/images/${path.basename(i)}`);

      // For desk phone, I don't want animation, so only include png files
      emojiImages.set(`${e}-${PAGES.DESK}`, images.filter(i => i.match(/\.png$/i)));

      // For wall phone, list includes all images, animated and unanimated
      emojiImages.set(`${e}-${PAGES.WALL}`, images);
    });

    return emojiImages;
  }


  /**
   * 
   */
  public getRandomEmojiImage(emoji: string, pageName: string): string {
    const images = this.emojiImages.get(`${emoji}-${pageName}`);
    return images ? images[Math.floor(Math.random() * images.length)] : '';
  }
}