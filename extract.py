import re
import os

filepath = r"c:\Users\Panth\Desktop\csu\CreditIQ\frontend\index.html"
style_path = r"c:\Users\Panth\Desktop\csu\CreditIQ\frontend\style.css"
script_path = r"c:\Users\Panth\Desktop\csu\CreditIQ\frontend\script.js"

with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

# Extract styles
style_pattern = re.compile(r'<style>(.*?)</style>', re.DOTALL)
styles = style_pattern.findall(content)
if styles:
    with open(style_path, "w", encoding="utf-8") as f:
        f.write("\n".join(styles))
    
    # Replace style blocks with link
    content = style_pattern.sub('<link rel="stylesheet" href="style.css" />', content, count=1)
    content = style_pattern.sub('', content)

# Extract scripts
script_pattern = re.compile(r'<script>(.*?)</script>', re.DOTALL)
scripts = script_pattern.findall(content)
if scripts:
    with open(script_path, "w", encoding="utf-8") as f:
        f.write("\n\n".join(scripts))
    
    # Replace the first script block with a src link, remove the rest
    content = script_pattern.sub('<script src="script.js"></script>', content, count=1)
    content = script_pattern.sub('', content)

# Backup original just in case
with open(filepath + ".bak", "w", encoding="utf-8") as f:
    with open(filepath, "r", encoding="utf-8") as orig:
        f.write(orig.read())

with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)

print("Extraction complete.")
