import os
from PIL import Image

def crop_logo():
    img_path = 'public/login_full.png'
    if not os.path.exists(img_path):
        print("Image not found:", img_path)
        return
    
    img = Image.open(img_path)
    width, height = img.size
    print(f"Original size: {width}x{height}")
    
    # The logo is in the top-left area. 
    # Let's find the bounding box of non-white pixels in the top-left quadrant (e.g. x < 200, y < 150)
    # White is defined as (255, 255, 255) or close to it.
    rgba_img = img.convert('RGBA')
    pixels = rgba_img.load()
    
    min_x, min_y = width, height
    max_x, max_y = 0, 0
    
    for y in range(0, min(150, height)):
        for x in range(0, min(250, width)):
            r, g, b, a = pixels[x, y]
            # If pixel is not white/transparent and has some color
            if a > 50 and not (r > 240 and g > 240 and b > 240):
                if x < min_x: min_x = x
                if y < min_y: min_y = y
                if x > max_x: max_x = x
                if y > max_y: max_y = y
                
    print(f"Detected logo bounding box: {min_x}, {min_y} to {max_x}, {max_y}")
    
    # Add a small padding (e.g. 5px)
    pad = 6
    crop_box = (
        max(0, min_x - pad),
        max(0, min_y - pad),
        min(width, max_x + pad),
        min(height, max_y + pad)
    )
    
    logo = img.crop(crop_box)
    logo.save('public/logo.png')
    logo.save('public/favicon.svg')  # Save as favicon too
    print("Logo cropped and saved successfully to public/logo.png and public/favicon.svg")

if __name__ == '__main__':
    crop_logo()
