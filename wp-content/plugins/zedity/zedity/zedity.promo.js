//add Premium promo feature tab
zedityEditor.menu.add({
	tabs: {
		premium: {
			title: 'Premium features',
			icon: 'zedity',
			order: 9000000,
			groups: {
				premium: {
					title: 'Premium',
					icon: 'zedity zicon-is-link',
					order: 20000,
					features: {
						premium: {
							type: 'button',
							label: 'Upgrade now!',
							order: 2000,
							onclick: function(){
								window.open('https://zedity.com/plugin/wp','_blank');
							}
						}
					}
				},
				content: {
					title: 'Content',
					features: {
						responsive: {
							type: 'extpanel',
							icon: 'responsive',
							label: 'Responsive',
							class: 'premium',
							build: function($panel){
								$panel.append(
									'<h3>Responsive content.</h3>'+
									'<ul class="zedity-premium-features">'+
										'<li><b>Responsive scaling:</b> the responsive scaling makes your Zedity content scale down as much as needed to fit the responsive layout of your theme.<br/>'+
										'<li><b>Multiple Layout Responsive Design:</b> With Zedity MLRD you create your content for very small page width (e.g. smartphones) and, afterwards, rearrange the position and size of the boxes for bigger layouts. Whenever needed, you can also use different images in different layouts!</li>'+
									'</ul>'
								);
							}
						},
						templates: {
							type: 'extpanel',
							icon: 'template',
							label: 'Templates',
							class: 'premium',
							build: function($panel){
								$panel.append(
									'<h3>Content templates.</h3>'+
									'<ul class="zedity-premium-features">'+
										'<li><b>Design once, use many:</b> re-use your designs as many times as you want.</li>'+
										'<li><b>Perfect design:</b> do you like tidy posts? Use a template to have all your posts styled exactly the same.</li>'+
									'</ul>'
								);
							}
						}
					}
				},
				moreboxes: {
					title: 'More boxes',
					features: {
						document: {
							type: 'extpanel',
							icon: 'document',
							label: 'Document',
							class: 'premium',
							build: function($panel){
								$panel.append(
									'<h3>Document Box.</h3>'+
									'<ul class="zedity-premium-features">'+
										'<li><b>Embed documents in your contents:</b> PDF documents, Microsoft Office documents, Apple Pages, Adobe Photoshop and Illustrator, and more.</li>'+
										'<li><b>Embed documents from popular online services:</b> Google Drive, SlideShare, Scribd.</li>'+
									'</ul>'
								);
							}
						},
						html: {
							type: 'extpanel',
							icon: 'html',
							label: 'Html',
							class: 'premium',
							build: function($panel){
								$panel.append(
									'<h3>Html Box.</h3>'+
									'<ul class="zedity-premium-features">'+
										'<li><b>Custom to the max:</b> for those cases where you want a piece of HTML code into a Zedity box!</li>'+
										'<li><b>Ultimate flexibility:</b> add code for Forms, Maps, Payment buttons, etc.</li>'+
									'</ul>'
								);
							}
						},
						draw: {
							type: 'extpanel',
							icon: 'draw',
							label: 'Draw',
							class: 'premium',
							build: function($panel){
								$panel.append(
									'<h3>Draw Box.</h3>'+
									'<ul class="zedity-premium-features">'+
										'<li><b>Eye catching:</b> highlight important parts of your pages.</li>'+
										'<li><b>Truly yours:</b> sign your articles with your real life signature.</li>'+
										'<li><b>Unleash the artist in you:</b> with the free hand drawing you can express your creativity, just doodle around or even paint your masterpieces.</li>'+
									'</ul>'
								);
							}
						}
					}
				},
				boxfeatures: {
					title: 'Box features',
					features: {
						format: {
							type: 'extpanel',
							icon: 'text',
							label: 'Text',
							class: 'premium',
							build: function($panel){
								$panel.append(
									'<h3>Advanced text formatting.</h3>'+
									'<ul class="zedity-premium-features">'+
										'<li><b>Headings and Paragraph:</b> use any heading (H1, H2, ..., H6) and paragraph tags as needed to achieve the desired style and SEO optimizations.</li>'+
										'<li><b>Custom web fonts:</b> give your distinctive style adding as many web fonts as you like, either from Google Fonts or self-hosted.</li>'+
										'<li><b>Custom link style:</b> You can customize the style of your text links whenever you want it to be different from the standard one. The customization includes also the mouse hover style, giving you total control to achieve any desired design.</li>'+
										'<li><b>Line height:</b> adjust line height to tidy up your text.</li>'+
										'<li><b>Paragraph spacing:</b> add space between one paragraph and the next, forget adding empty lines.</li>'+
										'<li><b>Paragraph alignment:</b> align paragraphs to Left, Center, Right, Justify. No need to use many boxes to have different alignments.</li>'+
										'<li><b>Lists:</b> numbered and bulleted lists.</li>'+
										'<li><b>Indentation:</b> indent and outdent functions.</li>'+
										'<li><b>Indices:</b> subscript and superscript text.</li>'+
									'</ul>'
								);
							}
						},
						media: {
							type: 'extpanel',
							icon: 'video',
							label: 'Media',
							class: 'premium',
							build: function($panel){
								$panel.append(
									'<h3>Additional media embed.</h3>'+
									'<ul class="zedity-premium-features">'+
										'<li><b>Video embed services:</b> Facebook, Instagram, dailymotion, metacafe, Ustream, myspace, veoh, metatube, Vine, Snotr, blip.tv, 5min, tune.pk, coub.</li>'+
										'<li><b>Audio embed services:</b> Vocaroo, myspace, SHOUTcast, Bandcamp.</li>'+
										'<li><b>Media Library:</b> add HTML5 video or audio directly from your WordPress Media Library.</li>'+
										'<li><b>Video autoplay:</b> video autoplay option for YouTube and Vimeo embeds.</li>'+
									'</ul>'
								);
							}
						},
						style: {
							type: 'extpanel',
							icon: 'style',
							label: 'Style',
							class: 'premium',
							build: function($panel){
								$panel.append(
									'<h3>Advanced styling.</h3>'+
									'<ul class="zedity-premium-features">'+
										'<li><b>Custom colors:</b> add unlimited colors with the Hex and RGB buttons, to enter any desired color your design requires.</li>'+
										'<li><b>Box shadow:</b> add shadow to your boxes.</li>'+
										'<li><b>Box padding:</b> to add desired space between border and content.</li>'+
										'<li><b>Image size:</b> ability to select image size from Media Library in the Image Box.</li>'+
									'</ul>'
								);
							}
						},
						arrange: {
							type: 'extpanel',
							icon: 'align',
							label: 'Arrange',
							class: 'premium',
							build: function($panel){
								$panel.append(
									'<h3>Advanced box arrangement.</h3>'+
									'<ul class="zedity-premium-features">'+
										'<li><b>Snap:</b> snap any box to the page or to other boxes, with a magnet-like effect.</li>'+
										'<li><b>Size and position:</b> set and show exact width and height for any box.</li>'+
										'<li><b>Adjustable grid:</b> create multiple column layouts, quick and precise alignment to give your site a professional look. The grid size can be set to any desired value.</li>'+
										'<li><b>Align:</b><ul>'+
											'<li>Box alignment to the top, middle, bottom, left, center, right of the page.</li>'+
											'<li>Fit a Box to the page width or height.</li>'+
											'<li>Multiple boxes vertical and horizontal alignment.</li>'+
										'</ul></li>'+
										'<li><b>Precise position:</b> use arrow keys to move the boxes around to find the desired position with pixel-perfect precision.</li>'+
									'</ul>'
								);
							}
						},
						links: {
							type: 'extpanel',
							icon: 'link',
							label: 'Links',
							class: 'premium',
							build: function($panel){
								$panel.append(
									'<h3>More than text links</h3>'+
									'<ul class="zedity-premium-features">'+
										'<li><b>Box link:</b> associate a link to any text, color or image boxes.</li>'+
										'<li><b>Content Link:</b> associate a link to the whole Zedity content. Useful to create banners, buttons and any other all-clickable content.</li>'+
									'</ul>'
								);
							}
						}
					}
				}
			}
		}
	}
});
