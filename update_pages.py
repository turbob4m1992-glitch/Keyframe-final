import os
import re
import glob

# 1. Update "Studio" to "5 ★" in all HTML files
html_files = glob.glob('**/*.html', recursive=True)

for file in html_files:
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()

    # Replace Studio in nav-title
    content = content.replace('><span class="nav-title">Studio</span>', '><span class="nav-title">5 ★</span>')
    content = content.replace('>\n        <span class="nav-title">Studio</span>', '>\n        <span class="nav-title">5 ★</span>')

    # Replace Studio in mm-link (mobile menu)
    content = re.sub(r'(<span class="no">\d+</span>)Studio(</a>)', r'\g<1>5 ★\g<2>', content)

    with open(file, 'w', encoding='utf-8') as f:
        f.write(content)

# 2. Update the "show the full showcase" button in services pages
services_files = [
    'services/mobile-apps/index.html',
    'services/web-experiences/index.html',
    'services/digital-marketing/index.html',
    'services/brand-identity/index.html',
    'services/cinematic-video/index.html',
    'services/ai-visualization/index.html'
]

btn_pattern = re.compile(r'(\s*)<a href="([^"]+)" class="btn btn-ghost magnetic reveal" style="flex:0 0 auto;">View the full showcase</a>\s*</div>', re.MULTILINE)

for file in services_files:
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    match = btn_pattern.search(content)
    if match:
        original_btn_str = match.group(0)
        indent = match.group(1)
        original_href = match.group(2)
        
        # Remove the button from its current location, leaving just the </div> for sec-head
        content = content[:match.start()] + indent + "</div>" + content[match.end():]
        
        grid_start_idx = content.find('<div class="lab-grid svc-duo">', match.start())
        if grid_start_idx != -1:
            end_grid_pattern = re.compile(r'(</article>\s*</div>)', re.MULTILINE)
            end_match = end_grid_pattern.search(content, grid_start_idx)
            
            if end_match:
                btn_href = "../../work/" if "web-experiences" in file else original_href
                
                new_btn_html = f'\n      <div style="display:flex; justify-content:center; margin-top:40px;">\n        <a href="{btn_href}" class="btn btn-ghost magnetic reveal">View the full showcase</a>\n      </div>'
                
                content = content[:end_match.end()] + new_btn_html + content[end_match.end():]
                
    with open(file, 'w', encoding='utf-8') as f:
        f.write(content)

print("Done")
