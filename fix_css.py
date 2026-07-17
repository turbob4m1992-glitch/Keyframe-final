import re

with open('showcase/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove the incorrectly placed media query
bad_css = """
@media (max-width: 760px) {
  .lab-feature .lab-media { aspect-ratio: auto; }
  .lab-feature .lab-info {
    position: relative; left: 0; right: 0; bottom: 0;
    flex-direction: column; align-items: flex-start;
    padding: 16px 4px 0;
  }
  .lab-feature .lab-info h3 { color: var(--fg); font-size: 1.4rem; }
  .lab-feature .lab-info p { color: var(--fg-muted); }
  .lab-feature .lab-shade { display: none; }
}
"""
content = content.replace(bad_css, '')

# Now find the last </style> and inject before it
style_indices = [m.start() for m in re.finditer(r'</style>', content)]
if style_indices:
    last_style_idx = style_indices[-1]
    
    # We want it to be clearly visible on mobile, maybe adjust text color to be light instead of var(--fg) if it's over dark bg?
    # Actually wait. The layout in the image attached shows the text is overlaid with no background (because it's outside lab-media but maybe overlapping it?).
    # Wait, the user attached an image! Let's look at it. 
    # In the image, L'Atelier Elena is written across the top edge of the image!
    # That means .lab-info is STILL positioned absolutely at the top or it was pushed there?
    # Ah! The user's image shows "L'Atelier Elena" floating on top of the `.lab-media` frame.
    # Why? Because .lab-info has `position: absolute; bottom: 24px;` in desktop CSS.
    # And since I moved it out of `.lab-media`, it is absolute to `.lab-feature`.
    # And `.lab-feature` has `display: block`? 
    # Wait! In the CSS for `.lab-feature .lab-info`, it has `bottom: 24px;`. This means it should be at the BOTTOM of `.lab-feature`.
    # Why is it at the TOP in the user's screenshot?
    # Because there's a `.lab-cinema` grid, or maybe `.lab-feature` is not relative?
    # No, `.lab-frame` is `position: relative`.
    # Let me ensure the CSS works perfectly.
    
    good_css = """
@media (max-width: 760px) {
  .lab-feature {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .lab-feature .lab-media { 
    aspect-ratio: auto;
  }
  .lab-feature .lab-info {
    position: relative; 
    left: auto; right: auto; bottom: auto;
    flex-direction: column; 
    align-items: flex-start;
    padding: 0 4px;
  }
  .lab-feature .lab-info h3 { font-size: 1.6rem; margin-bottom: 8px; }
  .lab-feature .lab-shade { display: none; }
}
"""
    content = content[:last_style_idx] + good_css + content[last_style_idx:]

with open('showcase/index.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("CSS fixed")
