import { globSync } from 'glob';
import path from 'path';
import { PAGES } from '../constants';


// Definition of a dictionary entry for a single emoji and its list of images
type EmojiImagesDictionary = Map<string, string[]>;


/**
 * Emoji Service
 * 
 * Responsible for being able to randomly provide an image for a given emoji.
 * This requires building a dictionary of images available for each emoji.
 */
export default class EmojiService {
  private emojiImagesDictionary: EmojiImagesDictionary = this.buildEmojiImagesDictionary();


  constructor(private readonly imagesFolder: string) {}


  /**
   * Build a dictionary of images for each emoji
   * 
   * Assumptions
   *   - All images are named either "emoji.xxx" or "emoji_x.*"
   * 
   * @returns a dictionary of arrays of images keyed by the emoji and the page
   *          name, because I do not want animated gif's bouncing around on my
   *          desk phone being a distraction. An example:
   *            {
   *              "8bit-desk": ["8bit_1.png", "8bit_2.png"],
   *              "8bit-wall": ["8bit_1.png", "8bit_2.png", "8bit_2.gif"],
   *              "brb-desk": ["brb.png"]
   *              "brb-wall": ["brb.png"]
   *            }
   */
  private buildEmojiImagesDictionary(): EmojiImagesDictionary {
    const dictionary: EmojiImagesDictionary = new Map<string, string[]>();

    // Get list of all files and use that to build a unique list of emojis by
    // stripping underscores and digits from each filename. So "8bit_1.png"
    // and "8bit_2.png" get reduced to "8bit".
    const filenames = globSync(`${this.imagesFolder}/*`);
    const emojis = Array.from(new Set(
      filenames.map(f =>
        path.basename(f, path.extname(f)).replace(/_\d+$/, '')
      )
    ));

    // For each emoji, get a list of matching images, then add entry for
    // the desk page and an entry for wall page.
    emojis.forEach(e => {
      const matchingImages = 
        globSync(`${this.imagesFolder}/${e}*`)
        .map(i => `/images/${path.basename(i)}`);

      // Desk phone only includes unanimated/png images
      dictionary.set(`${e}-${PAGES.DESK}`, matchingImages.filter(i => i.match(/\.png$/i)));

      // Wall phone includes all images
      dictionary.set(`${e}-${PAGES.WALL}`, matchingImages);
    });

    return dictionary;
  }


  /**
   * Get a randomized image for the specified emoji on the specified page
   * @param emoji - The emoji
   * @param pageName - The page name (desk|wall
   * @returns the image file name
   */
  public getRandomEmojiImage(emoji: string, pageName: string): string {
    const images = this.emojiImagesDictionary.get(`${emoji}-${pageName}`);

    return images ? images[Math.floor(Math.random() * images.length)] : '';
  }
}