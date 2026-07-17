import re

with open('showcase/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# We need to find the three instances of lab-info in the lab-feature blocks and move them outside the lab-media block.
# Pattern:
#             <div class="lab-info">
#               ... (any characters, non-greedy)
#             </div>
#           </div>
#         </figure>

pattern = re.compile(r'(\s*<div class="lab-info">[\s\S]*?</div>)\n          </div>\n        </figure>')

# Replace with:
#           </div>
#           <div class="lab-info">...</div>
#         </figure>

new_content = pattern.sub(r'\n          </div>\1\n        </figure>', content)

# Now we need to append the media query to the style block.
style_end_idx = new_content.find('</style>')
if style_end_idx != -1:
    media_query = """
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
    new_content = new_content[:style_end_idx] + media_query + new_content[style_end_idx:]

with open('showcase/index.html', 'w', encoding='utf-8') as f:
    f.write(new_content)

print("Done")
