import { globSync } from 'glob';
import path from 'path';
import { PAGES } from '../constants';


// Definition of a dictionary entry for a single image name and its list of image paths
type ImagePathsByName = Map<string, string[]>;


/**
 * Emoji Service
 * 
 * Responsible for being able to randomly provide an image for a given emoji.
 * This requires building a dictionary of images available for each emoji.
 */
export default class EmojiService {
  private imagePathsByName: ImagePathsByName = this.buildImagePathsByName();


  constructor(private readonly imagesFolder: string) {}


  /**
   * Build a dictionary of image paths for each image name.
   * 
   * Assumptions
   *   - All images are named either "emoji.xxx" or "emoji_x.*"
   * 
   * @returns a dictionary of arrays of image paths keyed by the image name and the page
   *          name, because I do not want animated gif's bouncing around on my
   *          desk phone being a distraction. An example:
   *            {
   *              "8bit-desk": ["/images/8bit_1.png", "/images/8bit_2.png"],
   *              "8bit-wall": ["/images/8bit_1.png", "/images/8bit_2.png", "/images/8bit_2.gif"],
   *              "brb-desk": ["/images/brb.png"]
   *              "brb-wall": ["/images/brb.png"]
   *            }
   */
  private buildImagePathsByName(): ImagePathsByName {
    const dictionary: ImagePathsByName = new Map<string, string[]>();

    // Get list of all files and use that to build a unique list of image names by
    // stripping underscores and digits from each filename. So "8bit_1.png"
    // and "8bit_2.png" get reduced to "8bit".
    const filenames = globSync(`${this.imagesFolder}/*`);
    const imageNames = Array.from(new Set(
      filenames.map(f =>
        path.basename(f, path.extname(f)).replace(/_\d+$/, '')
      )
    ));

    // For each emoji, get a list of matching images, then add entry for
    // the desk page and an entry for wall page.
    imageNames.forEach(imageName => {
      const matchingImages =
      globSync(`${this.imagesFolder}/${imageName}*`)
        .filter(i => path.extname(i).toLowerCase() !== '.disabled')
        .map(i => `/images/${path.basename(i)}`);

      // Desk phone only includes unanimated/png images
      dictionary.set(`${imageName}-${PAGES.DESK}`, matchingImages.filter(i => i.match(/\.png$/i)));

      // Wall phone includes all images
      dictionary.set(`${imageName}-${PAGES.WALL}`, matchingImages);
    });

    return dictionary;
  }


  /**
   * Get a randomized image path for the specified image name on the specified page.
   * @param imageName - The base image name used to resolve possible files
   * @param pageName - The page name (desk|wall)
   * @returns the image file path
   */
  public getRandomImagePath(imageName: string, pageName: string): string {
    const images = this.imagePathsByName.get(`${imageName}-${pageName}`);

    return images ? images[Math.floor(Math.random() * images.length)] : '';
  }
}