<html xmlns="http://www.w3.org/1999/html">
	<head>
		<title>Zedity - Create Content Easily</title>

		<link rel="stylesheet" href="<?php echo plugins_url("jquery/jquery-ui.min.css?{$this->plugindata['Version']}",dirname(__FILE__))?>" type="text/css" media="all" />
		<?php
		//remove all external scripts/styles
		global $wp_scripts, $wp_styles;
		if (!empty($wp_scripts) && !empty($wp_scripts->queue)) {
			foreach($wp_scripts->queue as $handle) {
				wp_dequeue_script($handle);
			}
		}
		if (!empty($wp_styles) && !empty($wp_styles->queue)) {
			foreach($wp_styles->queue as $handle) {
				wp_dequeue_style($handle);
			}
		}
		//add jQuery and jQueryUI bundled with WordPress
		wp_enqueue_script('jquery');
		if (version_compare($wp_version,'4.1','>=')) {
			wp_enqueue_script('jquery-ui-tabs');
			wp_enqueue_script('jquery-ui-dialog');
			wp_enqueue_script('jquery-ui-draggable');
			wp_enqueue_script('jquery-ui-resizable');
			wp_enqueue_script('jquery-ui-droppable');
			wp_enqueue_script('jquery-ui-menu');
			wp_enqueue_script('jquery-ui-slider');
			wp_enqueue_script('jquery-ui-tooltip');
			wp_enqueue_script('jquery-ui-accordion');
			wp_enqueue_script('jquery-ui-selectmenu');
			wp_enqueue_script('jquery-effects-core');
		} else {
			//old versions of WordPress have an obsolete jqueryui, add our own
			wp_enqueue_script('jquery-ui-custom',plugins_url("jquery/jquery-ui.min.js?{$this->plugindata['Version']}",dirname(__FILE__)),'jquery');
		}
		//print scripts
		wp_print_head_scripts();
		wp_print_footer_scripts();
		//get version data
		$version = $this->version_check();
		$promo = $this->promo_check();
		?>
		<script type="text/javascript">
		$ = jQuery;
		ZedityLang = '<?php echo substr(get_bloginfo('language'),0,2);?>';
		</script>
		
		<link rel="stylesheet" href="<?php echo plugins_url("zedity/zedity.min.css?{$this->plugindata['Version']}",dirname(__FILE__))?>" type="text/css" media="screen" />
<?php
		global $wpdb;
		$sql="SELECT id FROM wpz_posts WHERE post_type = 'post'";

		$posts = $wpdb->get_results($sql);
		?>
		<script>
			posts = [];
		</script>
		<?php
		foreach ($posts as $post)
		{
			$id = $post->id;

			$title = get_the_title($id);

			$cats = wp_get_post_categories($id);

			$tb = get_post_thumbnail_id($id);
			$url = wp_get_attachment_url($tb);
			$status = get_post_status($id);

			if (/*strlen($url) > 1*/ $title !== "Auto Draft" && $status = 'published') {
				?>
				<script>
					posts.push({
						id: '<?php echo $id; ?>',
						title: '<?php echo $title; ?>',
						cats: ['<?php foreach ($cats as $cat) {
							echo get_the_category_by_ID($cat)."','";
						}
							echo "All";
							?>'],
						img: '<?php echo $url; ?>r'
					});
				</script>
				<?php
			}
		}?>

		<script src="<?php echo plugins_url("zedity/zedity.min.js?{$this->plugindata['Version']}",dirname(__FILE__))?>" type="text/javascript"></script>

		<?php
		if (isset($options['webfonts'])) {
			foreach ($options['webfonts'] as $font) {
				$fontname = explode(',',$font);
				$fontname = urlencode($fontname[0]);
				?>
				<link href='//fonts.googleapis.com/css?family=<?php echo $fontname?>' rel='stylesheet' type='text/css'>
				<?php
			}
		}
		if (isset($options['customfontscss'])) {
			echo "<style type=\"text/css\">{$options['customfontscss']}</style>";
		} else {
			$options['customfonts'] = array();
		}
		?>

		<style>
			html,body {
				padding: 0;
				margin: 0;
				background: white;
			}
			#filler {
				width: 100%;
				height: 100px;
			}
			
			/*Normalize lists*/
			.zedity-box-Text ul {
				list-style-type: disc;
			}
			.zedity-box-Text ul ul,
			.zedity-box-Text ol ul {
				list-style-type: circle;
			}
			.zedity-box-Text ul ul ul,
			.zedity-box-Text ul ol ul,
			.zedity-box-Text ol ul ul,
			.zedity-box-Text ol ol ul {
				list-style-type: square;
			}
			.zedity-box-Text ol {
				list-style-type: decimal;
			}
			.zedity-box-Text ol ol,
			.zedity-box-Text ul ol {
				list-style-type: lower-alpha;
			}
			.zedity-box-Text ol ol ol,
			.zedity-box-Text ol ul ol,
			.zedity-box-Text ul ol ol,
			.zedity-box-Text ul ul ol {
				list-style-type: lower-roman;
			}
			
			/*Hide disabled features*/
			.zedity-dialog-responsive-outer .zedity-button-abort,
			.zedity-dialog-image .tabs li[aria-controls=tab-image-disk] {
				display: none !important;
			}
			
			.zicon-zedity {
				background-image: url("//ps.w.org/zedity/assets/icon.svg?<?php echo $this->plugindata['Version']?>");
			}
			.zedity-ribbon-group-subpanel[data-name=version] span.update {
				padding: 2px 5px;
				border-radius: 4px;
			}
			.zedity-ribbon-group-subpanel[data-name=version] span.update.ok {
				background-color: chartreuse;
			}
			.zedity-ribbon-group-subpanel[data-name=version] span.update.outdated {
				background-color: yellow;
			}
			
			/*PROMO messages*/
			.zedity-premium-features {
				padding-left: 20px;
				max-width: 400px;
			}
		</style>
	</head>

	<body>
		<?php $this->open_editor() ?>
		<div id="zedityEditorW"></div>
		<div id="filler"></div>

		<script type="text/javascript">
		//-----------------------------------------------------------------------------------------
		//helper functions
		var content = {
			mce: null,
			element: null,
			id: null,
			title: null,
			needBrBefore: <?php echo ($options['add_blank_lines']) ? 'true' : 'false'?>,
			needBrAfter: <?php echo ($options['add_blank_lines']) ? 'true' : 'false'?>,
			watermarkposition: '<?php echo !empty($options['watermark']) ? $options['watermark'] : 'none' ?>',
			responsive: <?php echo !empty($options['responsive']) ? $options['responsive'] : 0 ?>,
			savemode: '<?php echo !empty($options['save_mode']) ? $options['save_mode'] : 1 ?>', // 1: isolated (iframe); 2: standard (inline)
			alignment: '',
			needsPublish: false,
			//get content from tinymce editor
			getFromTinyMCE: function(){
				var content = '';
				//get TinyMCE reference
				this.mce = parent.tinyMCE.activeEditor;
				//get the Zedity content element
				this.element = this.mce.selection.getNode();
				this.element = this.mce.dom.getParent(this.element,function(elem){
					var $elem = $(elem);
					if ($elem.hasClass('zedity-editor') && $elem.parent().hasClass('zedity-wrapper')) return false;
					if ($elem.hasClass('zedity-iframe-wrapper') && $elem.parent().hasClass('zedity-wrapper')) return false;
					return $elem.hasClass('zedity-editor') || $elem.hasClass('zedity-wrapper') || $elem.hasClass('zedity-iframe-wrapper');
				});
				if (this.element) {
					//select content
					this.mce.selection.select(this.element);
					//get content
					content = this.mce.selection.getContent({format:'html'});
					//check if <br> is needed before/after the content
					<?php if ($options['add_blank_lines']) { ?>
						this.needBrBefore = $(this.element).prev(':not(.zedity-editor):not(.zedity-wrapper)').length==0;
						this.needBrAfter = $(this.element).next(':not(.zedity-editor):not(.zedity-wrapper):not(#zedity_content_overlay)').length==0;
					<?php } else { ?>
						this.needBrBefore = this.needBrAfter = false;
					<?php } ?>
				}
				//check if existing content
				var $content = $('<div/>').html(content);
				var $iframe = $content.find('.zedity-iframe-wrapper > iframe');
				if ($iframe.length) {
					//iframe
					this.savemode = 1;
					this.title = $iframe.attr('title');
					this.id = $iframe.attr('data-id');
					this.loadFromFile($iframe.attr('src'));
				} else if ($content.find('.zedity-editor').length) {
					//inline content
					this.savemode = 2;
					this.setContentInEditor($content.find('.zedity-editor').get(0).outerHTML);
				} else if ($content.children().length) {
					alert('<?php echo addslashes(__('The content may have been manually modified and got corrupted.','zedity'))?>');
				}
				//new content otherwise
				zedityEditor.contentChanged = false;
			},
			//send content to tinymce editor
			sendToTinyMCE: function(content){
				//re-select content
				this.mce.selection.select(this.element);
				//add a paragraph before and/or after the content (if needed) to permit adding text from WP editor if no other content is present
				if (this.element) {
					//now even mceInsertRawHTML doesn't work with tinyMCE 4, so we use DOM manipulation
					if (this.needBrBefore) this.element.parentNode.insertBefore($('<p>&nbsp;</p>')[0],this.element);
					if (this.needBrAfter) this.element.parentNode.insertBefore($('<p>&nbsp;</p>')[0],this.element.nextSibling);
					this.element.parentNode.replaceChild($(content)[0], this.element);
				} else {
					//insert raw HTML (mceInsertContent or send_to_editor() have problems #614)
					this.mce.execCommand('mceInsertRawHTML',false,
						(this.needBrBefore ? '<p>&nbsp;</p>' : '') +
						content +
						(this.needBrAfter ? '<p>&nbsp;</p>' : '')
					);
				}
				//force WP editor refresh
				parent.switchEditors.go(); //switch to text 
				parent.switchEditors.go(); //switch to visual => re-parse HTML code
				zedityEditor.contentChanged = false;
				//close editor window
				parent.zedityLightbox.close();
				//cleanup TinyMCE leftovers
				$(this.mce.getDoc()).find('style').each(function(idx,elem){
					var $elem = $(elem);
					if ($elem.hasClass('imgData') && $elem.parents('.zedity-editor').length==0) {
						$elem.remove();
					}
				});
				//show overlay on new content
				this.mce.plugins.zedity._zedityContent = $(this.mce.getDoc()).find('#'+zedityEditor.id)[0];
				if (this.needsPublish) parent.askPublish();
			},
			//convert content
			convert: function(content){
				var $div = $('<div/>').html(content);
				//get watermark
				this.watermarkposition = $div.find('.zedity-watermark').attr('data-pos') || 'none';
				//get alignment
				var $el = $div.find('.zedity-editor') || $div.find('.zedity-iframe-container');
				this.alignment = '';
				if ($el.hasClass('alignleft')) this.alignment='left';
				if ($el.hasClass('alignright')) this.alignment='right';
				if ($el.hasClass('aligncenter')) this.alignment='center';
				//remove <p> around images (inserted automatically by WP)
				$div.find('.zedity-box-Image').each(function(){
					$(this).find('p img').unwrap();
				});
				//unwrap images from anchors and set link
				$div.find('.zedity-box-Image a img').each(function(idx,elem){
					var $elem = $(elem);
					var href = $elem.parent().attr('href');
					var target = $elem.parent().attr('target');
					$elem.unwrap();
					$elem.closest('.zedity-box').attr('data-href',href).attr('data-target',target||'_top');
				});
				//find links with missing target (avoid opening links inside the iframe)
				$div.find('a:not([target])').each(function(){
					$(this).attr('target','_top').attr('data-target','_top');
				});
				//convert spacers
				$div.find('.zedity-spacer').replaceWith('<br/>');
				return $div.html();
			},
			//set content into Zedity editor
			setContentInEditor: function(content){
				this.responsive = $(content).hasClass('zedity-responsive') ? 1 : $(content).hasClass('zedity-responsive-layout') ? 2 : 0;
				content = this.convert(content);
				zedityEditor.page.content(content);
				//reset undo data
				Zedity.core.store.delprefix('zedUn');
				Zedity.core.gc.flushData();
				zedityEditor.page._saveUndo();
				setTimeout(function(){
					zedityEditor.contentChanged = false;
				},0);
			},
			//load content from file (via ajax direct url)
			loadFromFile: function(url){
				zedityEditor.lock('<p><?php echo addslashes(__('Loading content.','zedity'))?><br/><?php echo addslashes(__('Please wait...','zedity'))?></p>');
				console.log('Loading content from file via cached direct url='+url);
				$.ajax({
					type: 'GET',
					url: url, //use direct url because is already cached
					dataType: 'html',
					success: $.proxy(function(data){
						//let's not use jQuery and avoid reg exp
						var docfrag = document.createDocumentFragment();
						var d = document.createElement("div");
						d.innerHTML = data;
						docfrag.appendChild(d);
						data = docfrag.querySelector('.zedity-editor');

						this.setContentInEditor(data);
					},this),
					error: $.proxy(function(xhr,status,error){
						console.log('Failed. Status=',status,'\n error=',error);
						this.loadFromFile2(url);
					},this),
					complete: function(){
						zedityEditor.unlock();
					}
				});
			},
			//load content from file (via ajax helper)
			//(used if the cached url changed, causing an apparent cross domain)
			loadFromFile2: function(){
				var url = 'admin-ajax.php?action=zedity_ajax';
				console.log('Loading content from file (now via ajx helper), url='+url);
				zedityEditor.lock('<p><?php echo addslashes(__('Loading content.','zedity'))?><br/><?php echo addslashes(__('Please wait...','zedity'))?></p>');
				$.ajax({
					type: 'GET',
					url: url,
					data: {
						zaction: 'load',
						tk: '<?php echo (!empty($_REQUEST['att']) ? wp_create_nonce("zedity-load-{$_REQUEST['att']}") : '') ?>',
						id: this.id
					},
					dataType: 'json',
					success: $.proxy(function(data){
						if (data.error) {
							alert('<?php echo addslashes(__('Error during content load:','zedity'))?>\n'+data.error);
							return;
						}
						//let's not use jQuery and avoid reg exp
						var docfrag = document.createDocumentFragment();
						var d = document.createElement('div');
						d.innerHTML = data.content; //here data.content
						docfrag.appendChild(d);
						data = docfrag.querySelector('.zedity-editor');

						this.setContentInEditor(data);
					},this),
					error: function(xhr,status,error){
						alert('<?php echo addslashes(__('Unexpected error during content load:','zedity'))?>\n'+error.toString());
					},
					complete: function(){
						zedityEditor.unlock();
					}
				});
			},
			//save content to file
			saveToFile: function(content){
				zedityEditor.lock('<p><?php echo addslashes(__('Uploading content.','zedity'))?><br/><?php echo addslashes(__('Please wait...','zedity'))?></p>');
				$.ajax({
					type: 'POST',
					url: 'admin-ajax.php?action=zedity_ajax',
					data: {
						zaction: 'save',
						tk: '<?php echo wp_create_nonce("zedity-save-{$_REQUEST['post_id']}") ?>',
						id: this.id,
						post_id: parent.post_id,
						title: this.title,
						content: content
					},
					dataType: 'json',
					success: $.proxy(function(data){
						if (!data) {
							alert('<?php echo addslashes(__('Unexpected error during content save:','zedity'))?>\n<?php echo addslashes(__('No data received from the server.','zedity'))?>');
							return;
						}
						if (data.error) {
							alert('<?php echo addslashes(__('Error during content save:','zedity'))?>\n'+data.error);
							if (data.reload) location.reload();
							return;
						}
						var size = zedityEditor.page.size();
						var align = this.alignment==='' ? '' : ' align'+this.alignment;
						var $div = $(content);
						//construct <iframe> and wrappers
						if ($div.hasClass('zedity-responsive-layout')) {
							//new responsive layout
							var $wrapper = $(
								'<div id="'+zedityEditor.id+'" class="zedity-wrapper '+(zedityEditor._data.addClass||'')+align+'">'+
								'<div class="zedity-iframe-wrapper zedity-responsive-layout'+align+'" style="width:'+size.width+'px;height:'+size.height+'px">'+
								'<iframe class="zedity-iframe" src="'+data.url+'?'+Zedity.core.genId('')+'" style="width:100%;height:100%" scrolling="no" data-id="'+data.id+'"></iframe>'+
								'</div></div>'
							);
							//transfer data attributes
							$.each($div.get(0).attributes, function(idx,attr){
								if (/^data-layout/.test(attr.nodeName))
									$wrapper.find('.zedity-iframe-wrapper').attr(attr.nodeName,attr.nodeValue);
							});
						} else {
							var responsive = this.responsive==1 ? ' zedity-responsive' : '';
							var $wrapper = $(
								'<div id="'+zedityEditor.id+'" class="zedity-wrapper '+(zedityEditor._data.addClass||'')+align+'">'+
								'<div class="zedity-iframe-wrapper'+responsive+align+'" style="max-width:'+size.width+'px;max-height:'+size.height+'px" data-origw="'+size.width+'" data-origh="'+size.height+'">'+
								'<iframe class="zedity-iframe" src="'+data.url+'?'+Zedity.core.genId('')+'" width="'+size.width+'" height="'+size.height+'" scrolling="no" data-id="'+data.id+'"></iframe>'+
								'</div></div>'
							);
						}
						$wrapper.find('.zedity-iframe').attr('title',this.title);
						this.sendToTinyMCE($wrapper.get(0).outerHTML);
					},this),
					error: function(xhr,status,error){
						if (error.name=='SyntaxError') {
							alert('<?php echo addslashes(__('Unexpected error during content save.','zedity'))?>');
						} else {
							alert('<?php echo addslashes(__('Unexpected error during content save:','zedity'))?>\n'+error.toString());
						}
					},
					complete: function(){
						zedityEditor.unlock();
					}
				});
			},
			//add watermark to content
			setWatermark: function(content){
				var $html = $('<div/>').append(content);
				//if (this.watermarkposition=='none') {
				//	$html.find('.zedity-editor').append('<div class="zedity-watermark" style="display:none" data-pos="none"/>');
				//	return $html.html();
				//}
				var datapos;
				var css = "position:absolute;background:rgba(70,70,70,0.75);z-index:99999;padding:0 6px 1px;border-radius:6px;height:20px;line-height:20px;";
				switch (this.watermarkposition) {
					case 'topleft':
						datapos = 'topleft';
						css += "top:0;left:0;";
					break;
					case 'topright':
						datapos = 'topright';
						css += "top:0;right:0;";
					break;
					case 'bottomleft':
						datapos = 'bottomleft';
						css += "bottom:0;left:0;";
					break;
					case 'bottomright':
						datapos = 'bottomright';
						css += "bottom:0;right:0;";
					break;

					default:
						datapos = 'none';
						//css = "display:none;top:0;left:0;";
					break;
				}

				//construct watermark
				if (datapos!='none') {
					$html.find('.zedity-editor').append(
						'<div class="zedity-watermark" style="'+css+'" data-pos="'+datapos+'">'+
						'<span style="color:#ffd6ba;font-size:11px;font-family:Tahoma,Arial,sans-serif">Powered by <a href="https://zedity.com" target="_blank" style="font-size:11px;font-weight:bold;color:white;font-family:Verdana,Tahoma;text-decoration:none;">Zedity</a></span>'+'</div>'
					);
				}
				return $html.html();
			},
			//save content from editor
			save: function(){
				//scroll up
				$('html,body').scrollTop(0);
				var maxSize = <?php echo $this->MAX_UPLOAD_SIZE ?>;
				this.size = zedityEditor.page.size();
				//find links with missing target (avoid opening links inside the iframe)
				zedityEditor.$container.find('a:not([target])').each(function(){
					$(this).attr('target','_top').attr('data-target','_top');
				});
				//add spacers
				zedityEditor.$container.find('.zedity-box-Text').find('p,h1,h2,h3,h4,h5,h6').filter(':empty').append('<br/>');
				zedityEditor.$container.find('.zedity-box-Text p br').each(function(){
					var $this = $(this);
					if ($.trim($this.parent().text())=='') {
						$this.replaceWith('<span class="zedity-spacer">&nbsp;</span>');
					}
				});
				
				//alignment
				if (content.alignment) zedityEditor.$this.addClass('align'+content.alignment);
				<?php if ($this->is_premium()) { ?>
					//responsive
					zedityEditor.$this.toggleClass('zedity-responsive',this.responsive==1);
				<?php } ?>
				//size
				zedityEditor.$this.attr('data-origw',this.size.width).attr('data-origh',this.size.height);
				zedityEditor.save($.proxy(function(html){
					if (maxSize && html.length > maxSize) {
						alert(
							'<?php echo addslashes(__('The content you have created exceeds the maximum upload size for this site','zedity'))?> ('+Math.round(maxSize/1000000)+'MB).'+
							'\n\n'+
							'<?php echo addslashes(__('Please review your content and try again.','zedity'))?>'
						);
						return;
					}
					html = this.setWatermark(html);
					setTimeout($.proxy(function(){
						if (this.savemode==2) {
							//save inline
							this.needsPublish = false;
							var size = zedityEditor.page.size();
							var align = this.alignment==='' ? '' : ' align'+this.alignment;
							var style = this.responsive==1 ? ' style="max-width:'+size.width+'px;max-height:'+size.height+'px"' : '';
							this.sendToTinyMCE(
								'<div id="'+zedityEditor.id+'" class="zedity-wrapper '+(zedityEditor._data.addClass||'')+align+'"'+style+'>'+
								html+
								'</div>'
							);
						} else {
							//save in iframe
							this.saveToFile(html);
						}
					},this),10);
				},this));
			}
		};


		tickMenu = function($item){
			$item.find('.zedity-menu-icon').removeClass('zedity-icon-none').addClass('zedity-icon-yes');
			$item.siblings().each(function(idx,elem){
				$(elem).find('.zedity-menu-icon').removeClass('zedity-icon-yes').addClass('zedity-icon-none');
			});
		};

		$(document).on('dialogopen','.zedity-dialog-responsive',function(event,ui){
			//on dialog open, add link to tutorial
			if ($(this).find('.zedity-tutorial').length) return;
			$(this).append(
				'<p class="zedity-tutorial" style="text-align:center"><a href="https://zedity.com/blog/multiple-layout-responsive-design/" target="_blank">'+
					'<?php echo addslashes(__('Learn more about Multiple Layout Responsive Design','zedity'))?> (MLRD).'+
				'</a></p>'
			);
		});
		//-----------------------------------------------------------------------------------------
		//Media Library
		
		var zedity_ML_frame_image = null;
		$(document).on('dialogcreate','.zedity-dialog-image',function(event,ui){
			if (!zedity_ML_frame_image) {
				//add new tab for media library
				var $tabs = $('.zedity-dialog-image .tabs');
				$tabs.find('ul').prepend('<li><a href="#tab-image-ML"><?php echo addslashes(__('Media Library','zedity'))?></a></li>');
				$tabs.append(
					'<div id="tab-image-ML">'+
					'<p><?php echo addslashes(__('Insert an image from the WordPress Media Library.','zedity'))?></p>'+
					'<p><?php echo addslashes(__('You can choose among the images you already have in your library, or upload a new one.','zedity'))?></p>'+
					'<button class="ui-button ui-widget ui-state-default ui-corner-all ui-button-text-only zedity-open-ML"><span class="ui-button-text"><?php echo addslashes(__('Open Media Library...','zedity'))?></span></button>'+
					'</div>'
				);
				$tabs.tabs('refresh');
				$tabs.tabs('selected','tab-image-ML');
				$tabs.find('.zedity-open-ML').on('click.zedity',function(){
					zedity_ML_frame_image.open();
				});
				
				//create media library frame
				zedity_ML_frame_image = parent.wp.media.frames.zedity_media_frame = parent.wp.media({
					className: 'media-frame zedity-media-frame',
					title: jQuery(this).data('uploader_title'),
					button: {
						text: jQuery(this).data('uploader_button_text'),
					},
					library: {
						type: 'image'
					},
					multiple: false
				});
				zedity_ML_frame_image.on('select', function(){
					var $dialog = $('.zedity-dialog-image');
					var file = zedity_ML_frame_image.state().get('selection').first().toJSON();
					//console.log('file',file);
					$dialog.find('.tabs').tabs('selected','tab-image-link');
					$dialog.find('#zedity-txtImageLink').val(file.url);
					$dialog.find('#zedity-txtImageDescription').val(file.alt||file.description||file.title||file.caption);
				});
			}
		});

		//-----------------------------------------------------------------------------------------
		//Zedity editor


		var fontSizes = <?php echo json_encode($this->get_font_sizes())?>;
		var fonts = [
			'Arial,Helvetica,sans-serif',
			'Arial Black,Gadget,sans-serif',
			'Arial Narrow,sans-serif',
			'Century Gothic,sans-serif',
			'Comic Sans MS,cursive',
			'Copperplate Gothic Light,sans-serif',
			'Courier New,Courier,monospace',
			'Georgia,serif',
			'Gill Sans,sans-serif',
			'Impact,Charcoal,sans-serif',
			'Lucida Console,Monaco,monospace',
			'Lucida Sans Unicode,Lucida Grande,sans-serif',
			'Palatino Linotype,Book Antiqua,Palatino,serif',
			'Tahoma,Geneva,sans-serif',
			'Times New Roman,Times,serif',
			'Trebuchet MS,Helvetica,sans-serif',
			'Verdana,Geneva,sans-serif'
		];

		var webfonts = <?php echo json_encode($options['webfonts'])?>;
		var customfonts = <?php echo json_encode($options['customfonts'])?>;

		fonts = fonts.concat(webfonts);
		fonts = fonts.concat(customfonts);
		fonts = fonts.filter(function(a){if(!this[a]){this[a]=1;return a;}},{});
		fonts.sort(function(a,b){
			a = a.split(',')[0];
			b = b.split(',')[0];
			if (a > b) return 1;
			if (a < b) return -1;
			return 0;
		});
		
		zedityEditor = new Zedity({
			container: '#zedityEditorW',
			width: <?php echo $options['page_width']?>,
			height: <?php echo $options['page_height']?>,
			minWidth: <?php echo WP_Zedity_Plugin::MIN_WIDTH?>,
			maxWidth: <?php echo WP_Zedity_Plugin::MAX_WIDTH?>,
			minHeight: <?php echo WP_Zedity_Plugin::MIN_HEIGHT?>,
			maxHeight: <?php echo WP_Zedity_Plugin::MAX_HEIGHT?>,
			snapPage: <?php echo $options['snap_to_page']?'true':'false'?>,
			snapBoxes: <?php echo $options['snap_to_boxes']?'true':'false'?>,
			snapGrid: <?php echo $options['snap_to_grid']?'true':'false'?>,
			grid: {
				width: parseInt('<?php echo $options['grid_width']?>') || 100,
				height: parseInt('<?php echo $options['grid_height']?>') || 100
			},
			onchange: function(){
				this.contentChanged = true;
				<?php if (!$this->is_premium()) { ?>
					if ($('.zedity-fss-menu').length && !$('.zedity-fss-menu .ui-menu-item-promo').length) {
						$('.zedity-fss-menu').append(
							'<li data-value="0" class="ui-menu-item ui-menu-item-promo ui-state-disabled" role="presentation">'+
							'<a href="javascript:;" class="ui-corner-all" tabindex="-1" role="menuitem">'+
							'<small><?php echo addslashes(sprintf(__('More sizes in %s','zedity'),'Zedity Premium'))?></small>'+
							'</a></li>'
						);
					}
				<?php } ?>
			},
			onsave: function(){
				setTimeout(function(){
					saveContent();
				},100);
			},
			Text: {
				fontSizes: fontSizes,
				defaultFontSize: fontSizes.indexOf('14'),
				fonts: fonts
			},
			Image: {
				layout: 'fit',
				maxSize: 10485760, // 10MB (keep it in sync with utils/img2base64.php MAX_FILESIZE
				action: '<?php echo plugins_url('views/img2base64.php',dirname(__FILE__))?>'
			}
		});
		zedityEditor.page._sizeConstraints.minWidth = <?php echo WP_Zedity_Plugin::MIN_WIDTH?>;
		zedityEditor.page._sizeConstraints.minHeight = <?php echo WP_Zedity_Plugin::MIN_HEIGHT?>;
		zedityEditor.$this.addClass('zedity-notheme');
		
		zedityEditor.menu.add({
			tabs: {
				content: {
					groups: {
						save: {
							label: '<?php echo addslashes(__('Save','zedity'))?>',
							order: -2000,
							features: {
								save: {
									type: 'button',
									icon: 'save',
									label: '<?php echo addslashes(__('Save','zedity'))?>',
									onclick: function(){
										saveContent();
									},
									refresh: function(ed){
										this.$button.find('.zedity-ribbon-button-label').html(
											ed.responsive && ed.responsive.current ? 
												Zedity.t('Save "%s"',ed.responsive._options.layouts[ed.responsive.current].short) :
												'<?php echo addslashes(__('Save','zedity'))?>'
										);
									}
								},
								savemodelabel: {
									type: 'smallpanel',
									build: function($panel,ed){
										$panel.css('margin','0 0 10px 5px').append(
											'<span> <?php echo addslashes(__('Save mode:','zedity'))?></span> '+
											'<span class="zedity-contentmode-tt zedity-tooltip" title="">?</span>'
										);
										$panel.find('.zedity-contentmode-tt').prop('title',
											'<?php echo addslashes(__('<b>Isolated mode</b>: the HTML content is saved into a file in your Media Library and loaded inside an iframe into your page. This is useful to prevent the theme or other plugins from causing undesired modifications to your designs.','zedity'))?>'+'<br/>'+
											'<?php echo addslashes(__('<b>Standard mode</b>: the HTML content is saved inline, just like if it was created with the WordPress editor (and, as such, other plugins or the theme may modify it). This is the preferred mode for SEO and social sharing.','zedity'))?>'
										).tooltip();
									}
								},
								savemode: {
									type: 'menu',
									items: [{
										value: 1,
										label: '<?php echo addslashes(__('Isolated','zedity'))?>'
									},{
										value: 2,
										label: '<?php echo addslashes(__('Standard','zedity'))?>'
									}],
									onclick: function(value,ed){
										content.savemode = value;
									},
									refresh: function(ed){
										this.$menu.val(content.savemode).selectmenu('refresh');
									}
								},
							},
						},
						options: {
							label: '<?php echo addslashes(__('Options','zedity'))?>',
							order: -2000,
							features: {
								options: {
									type: 'extpanel',
									icon: 'config2',
									build: function($panel,ed){
										$panel.append(
											'<table>'+
												'<tr class="zedity-wp-align-feat">'+
													'<td><span><?php echo addslashes(__('Alignment','zedity'))?> &nbsp;</span></td>'+
													'<td><select class="zedity-wp-align">'+
														'<option value=""><?php echo addslashes(__('None','zedity'))?></option>'+
														'<option value="left"><?php echo addslashes(__('Left','zedity'))?></option>'+
														'<option value="center"><?php echo addslashes(__('Center','zedity'))?></option>'+
														'<option value="right"><?php echo addslashes(__('Right','zedity'))?></option>'+
													'</select></td>'+
												'</tr>'+
												'<tr class="zedity-wp-theme-feat">'+
													'<td><span><?php echo addslashes(__('Theme style','zedity'))?> &nbsp;</span></td>'+
													'<td><select class="zedity-wp-theme">'+
														'<option value="yes"><?php echo addslashes(__('Enabled','zedity'))?></option>'+
														'<option value="no"><?php echo addslashes(__('Disabled','zedity'))?></option>'+
													'</select></td>'+
												'</tr>'+
												'<tr class="zedity-wp-watermark-feat">'+
													'<td><span><?php echo addslashes(__('Watermark','zedity'))?> &nbsp;</span></td>'+
													'<td><select class="zedity-wp-watermark">'+
														'<option value="none"><?php echo addslashes(__('None','zedity'))?></option>'+
														'<option value="topleft"><?php echo addslashes(__('Top left','zedity'))?></option>'+
														'<option value="topright"><?php echo addslashes(__('Top right','zedity'))?></option>'+
														'<option value="bottomleft"><?php echo addslashes(__('Bottom left','zedity'))?></option>'+
														'<option value="bottomright"><?php echo addslashes(__('Bottom right','zedity'))?></option>'+
													'</select></td>'+
												'</tr>'+
												<?php if ($this->is_premium()) { ?>
													'<tr><td colspan="2"><hr style="border:0;height:1px;background:#ccc"/></td></tr>'+
													'<tr class="zedity-wp-mlrd">'+
														'<td><span>MLRD '+Zedity.t('Hidden boxes')+' &nbsp;</span></td>'+
														'<td><select class="zedity-mlrd-hiddenboxes">'+
															'<option value="0">'+Zedity.t('Hide')+'</option>'+
															'<option value="1">'+Zedity.t('Show as icons')+'</option>'+
														'</select></td>'+
													'</tr>'+
												<?php } ?>
											'</table>'
										);
										$panel.find('.zedity-wp-align').selectmenu({
											width: 130,
											appendTo: $panel,
											change: function(e,ui){
												content.alignment = ui.item.value;
												ed.$this.removeClass('alignleft alignright aligncenter');
												if (content.alignment) ed.$this.addClass('align'+content.alignment);
											}
										});
										$panel.find('.zedity-wp-theme').selectmenu({
											width: 130,
											appendTo: $panel,
											change: function(e,ui){
												ed.$this.toggleClass('zedity-notheme', ui.item.value=='no');
											}
										});
										$panel.find('.zedity-wp-watermark').selectmenu({
											width: 130,
											appendTo: $panel,
											change: function(e,ui){
												content.watermarkposition = ui.item.value;
											}
										});
										$panel.find('.zedity-mlrd-hiddenboxes').selectmenu({
											width: 130,
											appendTo: $panel,
											change: function(e,ui){
												if (!ed.responsive) return;
												ed.$this.toggleClass('zedity-mlrd-hideboxes',parseInt(ui.item.value,10)==0);
											}
										});
									},
									refresh: function(ed){
										this.$extpanel.find('.zedity-wp-align').val(content.alignment||'').selectmenu('refresh');
										this.$extpanel.find('.zedity-wp-theme').val(ed.$this.hasClass('zedity-notheme')?'no':'yes').selectmenu('refresh');
										this.$extpanel.find('.zedity-wp-theme-feat').toggleClass('zedity-disabled',content.savemode==1);
										this.$extpanel.find('.zedity-wp-watermark').val(content.watermarkposition).selectmenu('refresh');
										if (!ed.responsive) return;
										this.$extpanel.find('.zedity-wp-mlrd').toggleClass('zedity-disabled',!ed.responsive.current);
										this.$extpanel.find('.zedity-mlrd-hiddenboxes').val(ed.$this.hasClass('zedity-mlrd-hideboxes')?0:1).selectmenu('refresh');
									}
								},
								separator: {
									type: 'separator'
								},
								responsivefreelabel: {
									type: 'smallpanel',
									build: function($panel){
										$panel.css('margin','0 0 10px 5px').append('<span> <?php echo addslashes(__('Responsive:','zedity'))?></span>');
									}
								},
								responsivefree: {
									type: 'menu',
									width: 170,
									items: [{
										value: 0,
										label: '<?php echo addslashes(__('No','zedity'))?>'
									},{
										value: 1,
										label: '<?php echo addslashes(__('Scaling','zedity'))?> (Premium)',
										class: 'ui-state-disabled'
									},{
										value: 2,
										label: '<?php echo addslashes(__('Multiple layout','zedity'))?> (Premium)',
										class: 'ui-state-disabled'
									}]
								}
							}
						}
					}
				},
				info: {
					icon: 'info <?php echo ($version['update_available'] ? 'zicon-anim-spin' : '')?>',
					order: 100000,
					groups: {
						plugin: {
							title: '<?php echo addslashes(__('Plugin','zedity'))?>',
							features: {
								version: {
									type: 'panel',
									build: function($panel){
										$panel.append(
											'<table>'+
											'<tr><td><?php echo addslashes(__('Your version','zedity'))?></td><td><b><?php echo $version['installed']?></b></td></tr>'+
											'<tr><td><?php echo addslashes(__('Latest version','zedity'))?></td><td><b><?php echo $version['latest']?></b></td></tr>'+
											'<tr><td colspan="2" style="padding-top:7px"><span class="update <?php echo $version['update_available'] ? 'outdated' : 'ok' ?>">'+
												'<?php echo addslashes($version['update_available'] ? __('Please update!','zedity') : __('You are OK!','zedity')) ?>'+
											'</span></td></tr>'+
											'</table>'
										);
									}
								},
								update: {
									type: 'button',
									icon: 'download zicon-is-link',
									label: '<?php echo addslashes(__('Update','zedity'))?>',
									title: '<?php echo addslashes(__('Update','zedity'))?>',
									onclick: function(){
										window.open('<?php echo $this->is_premium() ? "{$this->zedityServerBaseUrl}/plugin/wp" : 'plugins.php#zedity'?>','_blank');
									},
									show: function(){
										return <?php echo ($version['update_available'] ? 'true' : 'false') ?>;
									}
								},
								rate: {
									type: 'button',
									icon: 'rate zicon-is-link',
									label: '<?php echo addslashes(sprintf(__('Rate %s!','zedity'),'Zedity'))?>',
									title: '<?php echo addslashes(sprintf(__('Rate %s!','zedity'),'Zedity'))?>',
									onclick: function(){
										window.open('https://wordpress.org/support/view/plugin-reviews/zedity','_blank');
									}
								}
							}
						},
						help: {
							title: '<?php echo addslashes(__('Help','zedity'))?>',
							features: {
								blog: {
									type: 'button',
									icon: 'help zicon-is-link',
									label: '<?php echo addslashes(__('Blog','zedity'))?>',
									title: '<?php echo addslashes(__('Blog','zedity'))?>',
									onclick: function(){
										window.open('https://zedity.com/blog/tutorials','_blank');
									}
								}
							}
						}
					}
				}
			},
			onadd: function(ed){
				//hide unsupported features
				ed.menu._group('content','responsive').show = function(){return false};
				ed.menu._feature('editbox','imagebox','filters').show = function(){return false};
				(ed.menu._feature('editbox','imagebox','config').$extpanel||$()).find('.zedity-image-quality-feat').hide();
			}
		});
		
		//save
		var saveContent = function(){
			if (zedityEditor.responsive && zedityEditor.responsive.current) {
				zedityEditor.responsive.saveLayout();
				return;
			}
			if (content.title || content.savemode==2) {
				content.save();
			} else {
				Zedity.core.dialog({
					question: '<?php echo addslashes(sprintf(__('Please provide a title for this %s content:','zedity'),'Zedity'))?> '+
						'<span class="zedity-tooltip" title="<?php echo addslashes(__('A short description used as the name of the file into which the content is saved in your Media Library.','zedity'))?>">?</span>',
					mandatory: '<?php echo addslashes(__('Please insert a title.','zedity'))?>',
					ok: function(answer){
						content.title = answer;
						content.save();
					}
				});
			}
		};
		
		var keepTooltipOpen = function(event){
			var $target = $(event.target);
			if (!$target.hasClass('zedity-tt')) $target = $target.parents('.zedity-tt');
			if ($target.length==0) return;

			event.stopImmediatePropagation();
			var fixed = setTimeout(function(){
				$target.tooltip('close');
			},200);
			$('.ui-tooltip').hover(function(){
				clearTimeout(fixed);
			}, function(){
				$target.tooltip('close');
			});
			false;
		};

		</script>
		
		<?php $this->additional_editor_js($options); ?>
		
		<script type="text/javascript">
		<?php if (!empty($promo['promocode'])) { ?>
			//add ongoing promo notification and badge
			var $b = zedityEditor.menu._feature('premium','premium','premium').$button;
			$b.find('.zicon').after('<span class="zicon zicon-happy zicon-anim-spin"></span>');
			$b.attr('title','<?php echo $promo['message'] ?>').tooltip();
			zedityEditor.menu.tabBadge('premium','promo','promo');
			zedityEditor.menu.$tabs.find('.zedity-ribbon-tab[data-name=premium] .zicon').addClass('zicon-anim-spin');
		<?php } ?>
		<?php if ($version['update_available']) { ?>
			//add new version badge
			zedityEditor.menu.tabBadge('info','update','new');
		<?php } ?>
		//stop notification spinning after 30 seconds
		setTimeout(function(){
			zedityEditor.menu.$tabs.find('.zicon-anim-spin').removeClass('zicon-anim-spin');
		},30*1000);

		//set content
		try {
			content.getFromTinyMCE();
		} catch(e) {
			console.log('getFromTinyMCE() exception: '+e.name+': '+e.message);
		}
		
		//tutorials
		Zedity.tutorials._tutorials['intro1'].tutorial.push(function(){
			this.editor.menu.openTab('info');
			this.showHighlight(this.editor.menu._feature('info','help','tutorials').$button,'You can run this and other tutorials whenever you need them.');
		});
		Zedity.tutorials.addMenu(zedityEditor,'info','help');
		
		if (!content.element && !Zedity.core.store.get('zedity-tutorial',window.localStorage)) {
			var res = confirm(
				'<?php echo addslashes(sprintf(__('This is the first time you open %s.','zedity'),'Zedity'))?>' +
				'\n' +
				'<?php echo addslashes(__('Do you want to run a tutorial?','zedity'))?>'
			);
			if (res) {
				Zedity.tutorials.start(zedityEditor,'intro1');
			} else {
				alert('<?php echo addslashes(__('You can view tutorials at any time from the "Info" tab.','zedity'))?>');
			}
			Zedity.core.store.set('zedity-tutorial',1,window.localStorage);
		}
		</script>
	</body>
	
</html>
