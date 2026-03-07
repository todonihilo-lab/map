import os
import time
import random
import requests
from pathlib import Path
from PIL import Image
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed

IMAGES_DIR = Path(__file__).parent / "images"
TILE_SIZE = 128


def zoom_to_suffix(zoom: int) -> str:
    mapping = {
        0: "flat//",
        1: "flat//z_",
        2: "flat//zz_",
        3: "flat//zzz_",
        4: "flat//zzzz_",
        5: "flat//zzzzz_",
        #they way that dynamap does zoom is funky, it adds "z" to the url for each level of zoom
    }
    if zoom not in mapping:
        raise ValueError(f"Unsupported zoom level {zoom}. Use 0, 1, 2, 3, 4, or 5.")
    return mapping[zoom]


def zoom_to_step(zoom: int) -> int:
    step_mapping = {
        #when zooming, the distance between tiles increases. this also increases the time by hence the multi threading expoentially. ((max_x * 2)/step)^2 (basically just the area of a square)
        0: 1,
        1: 2,
        2: 4,
        3: 8,
        4: 16,
        5: 32,
    }
    if zoom not in step_mapping:
        raise ValueError(f"Unsupported zoom level {zoom}. Use 0, 1, 2, 3, 4, or 5.")
    return step_mapping[zoom]


def download_image(url: str, filename: Path) -> None:
    resp = requests.get(url, timeout=30)
    resp.raise_for_status()
    filename.write_bytes(resp.content)
    #maybe i can make a better loading bar but this works and technically gives more info which could be useful
    #print(f"Downloaded {filename}")


def scrape_and_download_images(base_url: str, min_x: int, max_x: int, min_y: int, max_y: int, step: int, max_workers: int) -> None:
    IMAGES_DIR.mkdir(exist_ok=True)
    #zoom level 2 needed 100,000 images, i wasn't gonna wait for single threading, O^2 time
    #will upload the older single threaded version, would be surprised if anyone actually uses it tho
    tasks = []
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        for x in range(min_x, max_x + 1, step):
            for y in range(min_y, max_y + 1, step):
                url = f"{base_url}{x}_{y}.jpg"
                filename = IMAGES_DIR / f"{x}_{y}.jpg"

                if filename.exists():
                    print(f"{filename} already exists, skipping...")
                    continue
                # schedule the download
                tasks.append(executor.submit(download_image, url, filename))

        # optional: wait and log as they finish
        for future in as_completed(tasks):
            try:
                future.result()
            except Exception as e:
                print(f"Download failed: {e}")

    print("All images downloaded (or skipped if existing).")

#sitching the images together is the easy part, since everything before was learning how dynamap seperates images, we know how to put them back together
def stitch_images(min_x: int, max_x: int, min_y: int, max_y: int, step: int, output_filename: Path) -> None:
    width_tiles = (max_x - min_x + step) // step
    height_tiles = (max_y - min_y + step) // step

    final_width = width_tiles * TILE_SIZE
    final_height = height_tiles * TILE_SIZE

    final_image = Image.new("RGBA", (final_width, final_height), (0, 0, 0, 0))

    for y_index, y in enumerate(range(max_y, min_y - 1, -step)):
        row_y = y_index * TILE_SIZE
        for x_index, x in enumerate(range(min_x, max_x + 1, step)):
            tile_path = IMAGES_DIR / f"{x}_{y}.jpg"
            if not tile_path.exists():
                print(f"Missing tile {tile_path}, leaving blank.")
                continue
            try:
                tile_img = Image.open(tile_path).convert("RGBA")
            except Exception as e:
                print(f"Failed to open {tile_path}: {e}")
                continue

            col_x = x_index * TILE_SIZE
            final_image.paste(tile_img, (col_x, row_y))

        print(f"Stitched row y={y}")

    # flatten alpha onto a black background so transparent areas become black, dark mode forever
    if final_image.mode == "RGBA":
        background = Image.new("RGB", final_image.size, (0, 0, 0))
        background.paste(final_image, mask=final_image.split()[3])
        final_image = background
    else:
        final_image = final_image.convert("RGB")

    #optimize=True for progressive jpg, should probably always use this unless youre just gonna stare at it locally
    final_image.save(output_filename, format="JPEG", quality=85, optimize=True)
    print(f"Final image saved as {output_filename}")

    final_width = width_tiles * TILE_SIZE
    final_height = height_tiles * TILE_SIZE


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        #they way that dynamap does zoom is funky, it adds "z" to the url for each level of zoom
        "--zoom",
        type=int,
        choices=[0, 1, 2, 3, 4, 5],
        default=4,
        help="Zoom level: 0, 1, 2, 3, 4, or 5 (default 5, all the way zoomed out)",
    )
    #multi threading for downloading, please be considerate of the server as youre sending at least thousands of requests usually
    parser.add_argument(
        "--max-workers",
        type=int,
        default=8,
        help="Maximum number of concurrent download workers (default: 8)",
    )
    args = parser.parse_args()

    suffix = zoom_to_suffix(args.zoom)
    step = zoom_to_step(args.zoom)
    base_url = f"https://minecraft.novylen.net/map/smp/standalone/MySQL_tiles.php?tile=world/{suffix}"

    #youll need to figure this out for your specific map by looking at the top left and bottom right of the map
    #there are small differences between the zooms
    #would be cool to do this automatically but i dont think i can since dynamap give blank tiles into the inifinite void
    min_x = -640
    max_x = 624
    min_y = -624
    max_y = 640

    print(f"Using zoom {args.zoom}, base_url: {base_url}, step: {step}, max_workers: {args.max_workers}")
    scrape_and_download_images(base_url, min_x, max_x, min_y, max_y, step, args.max_workers)

    output_path = "map-dyna.jpg"
    stitch_images(min_x, max_x, min_y, max_y, step, output_path)


if __name__ == "__main__":

    main()
