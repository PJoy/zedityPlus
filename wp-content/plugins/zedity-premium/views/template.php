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
wp_enqueue_script('jquery-ui-tabs');
wp_enqueue_script('jquery-ui-dialog');
wp_enqueue_script('jquery-ui-tooltip');

//get all posts/pages
global $wpdb;
$posts = $wpdb->get_results("
	SELECT ID, post_title, post_status, post_author, post_type
	FROM {$wpdb->posts}
	WHERE post_type = 'post'
		AND post_status IN ('publish','draft')
	ORDER BY post_modified DESC
", OBJECT);
$pages = $wpdb->get_results("
	SELECT ID, post_title, post_status, post_author, post_type
	FROM {$wpdb->posts}
	WHERE post_type = 'page'
		AND post_status IN ('publish','draft')
	ORDER BY post_title
", OBJECT);

//remove posts/pages that current user cannot edit
function remove_noneditable(&$posts){
	global $current_user;
	//get_currentuserinfo();
	foreach ($posts as $key => $post) {
		if (!current_user_can('edit_others_posts',$post->ID) && ($post->post_author!=$current_user->ID)) {
			unset($posts[$key]);
		}
	}
}
remove_noneditable($posts);
remove_noneditable($pages);


function print_list($posts){
	?>
	<div class="scrollpanel">
		<table class="posts" cellspacing="0">
			<?php foreach ($posts as $post) { ?>
				<tr>
					<td><input type="radio" name="post" id="rbPost<?php echo $post->ID?>" value="<?php echo $post->ID?>" data-status="<?php echo $post->post_status?>" data-type="<?php echo $post->post_type?>" data-tk="<?php echo wp_create_nonce("zedity-addcontent-{$post->post_type}-{$post->ID}")?>"></td>
					<td><label for="rbPost<?php echo $post->ID?>" class="title"><?php echo !empty($post->post_title) ? $post->post_title : __('(no title)','zedity')?></label></td>
					<td><label for="rbPost<?php echo $post->ID?>"><?php echo $post->ID ?></label></td>
				</tr>
			<?php } ?>
		</table>
	</div>
	<?php
}

?>
<html>
	<head>
		<title>Zedity - Content duplication</title>
		<link rel="stylesheet" href="<?php echo plugins_url("jquery/jquery-ui.min.css?{$this->plugindata['Version']}",dirname(__FILE__))?>" type="text/css" media="all" />

		<?php
		//print scripts
		wp_print_head_scripts();
		wp_print_footer_scripts();
		?>
		
		<style>
		body,html {
			font-family: Verdana,Arial,sans-serif;
			font-size: 13px;
		}
		table,
		.ui-widget {
			font-size: 13px;
		}
		.ui-tabs .ui-tabs-nav {
			background: none;
			border: none;
			border-bottom: 1px solid #aaa;
			border-radius: 0;
		}
		.ui-tabs .ui-tabs-nav li {
			margin: 1px 0 0 5px;
		}
		.ui-tabs .ui-tabs-nav li a {
			outline: none;
		}
		.scrollpanel {
			height: 200px;
			overflow-y: auto;
		}
		table.posts {
			width: 100%
		}
		table.posts tr td:first-child,
		table.posts tr td:last-child {
			width: 0%;
			text-align: right;
		}
		table.posts tr td:nth-child(2) {
			width: 100%;
		}
		table.posts tr td label {
			display: inline-block;
			width: 100%;
		}
		table.posts tr:hover {
			background: whitesmoke;
		}
		table.posts tr.selected {
			background: lightgray;
		}
		table.above {
			padding-bottom: 10px;
			margin-bottom: 10px;
			border-bottom: 1px solid #aaa;
		}
		.options {
			float: left;
			width: 50%;
			min-height: 70px;
			padding: 10px;
			box-sizing: border-box;
			margin-top: 10px;
		}
		.options table td {
			vertical-align: top;
		}
		input, label {
			vertical-align: middle;
		}
		#dlgWait {
			min-height: 150px !important;
		}
		.dialog-wait .ui-dialog-titlebar button {
			display: none;
		}
		.disabled {
			opacity: 0.4;
			pointer-events: none;
		}
		.notice {
			display: none;
		}
		</style>
	</head>

	<body>
		<p class="notice notice-standard">
			<?php echo sprintf(__('The content you\'re about to duplicate was saved in %s mode.','zedity'),'<b>'.__('Standard','zedity').'</b>')?><br/>
			<?php _e('Modifications to the duplicated content will not affect the original one.','zedity')?>
		</p>
		<p class="notice notice-isolated">
			<?php echo sprintf(__('The content you\'re about to duplicate was saved in %s mode.','zedity'),'<b>'.__('Isolated','zedity').'</b>')?><br/>
			<?php _e('Modifications to the duplicated content will also affect the original one and any of its duplicates.','zedity')?>
		</p>
		<p><?php echo sprintf(__('Select the destination page or post which you want to copy this %s content into.','zedity'),'Zedity')?></p>
		<div id="tabs">
			<ul>
				<li><a href="#tab-posts"><?php _e('Posts','zedity')?></a></li>
				<li><a href="#tab-pages"><?php _e('Pages','zedity')?></a></li>
			</ul>
			<div id="tab-posts" class="tab">
				<table class="posts above" cellspacing="0">
					<tr class="new">
						<td><input type="radio" name="post" id="rbPost-1" value="-1" data-status="" data-type="post" data-tk="<?php echo wp_create_nonce("zedity-addcontent-post")?>"></td>
						<td><label for="rbPost-1"><?php _e('New Post','zedity')?></label></td>
						<td></td>
					</tr>
				</table>
				<?php print_list($posts); ?>
			</div>
			<div id="tab-pages" class="tab">
				<table class="posts above" cellspacing="0">
					<tr class="new">
						<td><input type="radio" name="post" id="rbPost-2" value="-2" data-status="" data-type="page" data-tk="<?php echo wp_create_nonce("zedity-addcontent-page")?>"></td>
						<td><label for="rbPost-2"><?php _e('New Page','zedity')?></label></td>
						<td></td>
					</tr>
				</table>
				<?php print_list($pages); ?>
			</div>
		</div>
		<div>
			<div class="ui-widget-content ui-corner-all ui-widget options statusfilter">
				<table>
					<tr>
						<td><?php _e('Filter status:','zedity')?></td>
						<td>
							<input type="checkbox" id="cbPublished" class="cbStatus" value="publish" checked="checked"><label for="cbPublished"><?php _e('Published','zedity')?></label><br/>
							<input type="checkbox" id="cbDraft" class="cbStatus" value="draft" checked="checked"><label for="cbDraft"><?php _e('Draft','zedity')?></label>
						</td>
					</tr>
				</table>
			</div>
			<div class="ui-widget-content ui-corner-all ui-widget options contentposition">
				<table>
					<tr>
						<td><?php _e('Content position:','zedity')?></td>
						<td>
							<input type="radio" id="rbAbove" class="rbPosition" name="rbPosition" value="above"><label for="rbAbove"><?php _e('Above existing content','zedity')?></label><br/>
							<input type="radio" id="rbBelow" class="rbPosition" name="rbPosition" value="below" checked="checked"><label for="rbBelow"><?php _e('Below existing content','zedity')?></label>
						</td>
					</tr>
				</table>
			</div>
		</div>
		<div style="float:right;margin:10px 20px 0 0;">
			<button id="btnCopy" class="disabled"><?php _e('Copy content','zedity')?></button>
		</div>
		
		<div id="dlgWait" style="display:none">
			<div class="wait">
				<p><?php _e('The content is being copied.','zedity')?></p>
				<p><?php _e('Please wait...','zedity')?></p>
			</div>
			<div class="done" style="display:none">
				<p><?php echo sprintf(__('The %s content has been successfully duplicated into the %s.','zedity'),'Zedity','<span class="type"></span><span class="title"></span>')?></p>
				<p><a class="editlink" href="#" target="_blank"><?php echo sprintf(__('Open the %s in a new tab to check it out.','zedity'),'<span class="type"></span>')?></a></p>
			</div>
		</div>
		
		<script type="text/javascript">
		$ = jQuery;
		$(function(){
			$(parent.document).find('#TB_iframeContent').addClass('zedity-templates-iframe');
			//create tabs
			$('#tabs').tabs();
			$('button').button();
			var $posts = $('table.posts');
			
			//----------------------------------------------------------------------------
			//dialog setup
			var $dialog = $('#dlgWait').dialog({
				title: '<?php echo addslashes(__('Content Duplication','zedity'))?>',
				dialogClass: 'dialog-wait',
				width: 360,
				autoOpen: false,
				draggable: false,
				resizable: false,
				modal: true,
				open: function(){
					$dialog.parent().find('button.dialog-button-close').button('disable');
				},
				buttons: [{
					text: 'Close',
					class: 'dialog-button-close',
					click: function(){
						parent.tb_remove();
					}
				}]
			});
			
			//----------------------------------------------------------------------------
			//get selected content html
			var mce = parent.tinyMCE.activeEditor;
			var element = mce.selection.getNode();
			element = mce.dom.getParent(element,function(elem){
				var $elem = $(elem);
				if ($elem.hasClass('zedity-editor') && $elem.parent().hasClass('zedity-wrapper')) return false;
				if ($elem.hasClass('zedity-iframe-wrapper') && $elem.parent().hasClass('zedity-wrapper')) return false;
				return $elem.hasClass('zedity-editor') || $elem.hasClass('zedity-wrapper') || $elem.hasClass('zedity-iframe-wrapper');
			});
			if (element) {
				//get content
				mce.selection.select(element);
				var html = mce.selection.getContent({format:'html'});
				$('.notice-'+($(html).find('iframe.zedity-iframe').length?'isolated':'standard')).show();
			} else {
				alert('Error during content load.');
				parent.tb_remove();
			}
			
			//status filter
			$('.cbStatus').on('click',function(){
				var $this = $(this);
				var status = $this.val();
				var checked = !!$this.attr('checked');
				$posts.find('input[data-status='+status+']').closest('tr').toggle(checked);
				
				//unselect if the selected page/post became hidden
				var $selected = $posts.find('tr.selected');
				if (!$selected.is(':visible')) {
					$selected.removeClass('selected')
						.find('input').prop('checked',false).removeAttr('checked');
					$('#btnCopy').addClass('disabled');
				}
			});
			
			//page/post selection
			$('table.posts tr').on('click',function(){
				var $this = $(this);
				if ($this.hasClass('selected')) return;
				//unselect all
				$posts.find('tr').removeClass('selected');
				$posts.find('input').prop('checked',false).removeAttr('checked');
				//select this
				$this.addClass('selected');
				$this.find('input').prop('checked',true).attr('checked','checked').trigger('change');
			});
			
			$posts.find('input').on('change',function(){
				var $this = $(this);
				$('#btnCopy').removeClass('disabled');
				$('.contentposition').toggleClass('disabled',$this.val()<0);
			});
			
			//----------------------------------------------------------------------------
			$('#btnCopy').on('click',function(){
				var $selected = $posts.find('input:checked');
				var id = $selected.val();
				var type = $selected.attr('data-type');
				switch (type) {
					case 'post':
						var typetext = id<0 ? '<?php echo addslashes(__('New Post','zedity'))?>' : '<?php echo addslashes(__('Post','zedity'))?>';
					break;
					case 'page':
						typetext = id<0 ? '<?php echo addslashes(__('New Page','zedity'))?>' : '<?php echo addslashes(__('Page','zedity'))?>';
					break;
				}
				//var pop = window.open('admin-ajax.php?action=zedity_ajax&zaction=pleasewait','_blank');
				$dialog.dialog('open');
				
				$.ajax({
					type: 'POST',
					url: 'admin-ajax.php?action=zedity_ajax',
					data: {
						zaction: 'addcontent',
						tk: $selected.attr('data-tk'),
						content: html,
						id: id,
						type: type,
						position: $('input[name=rbPosition]:checked').val()
					},
					dataType: 'json',
					success: function(data){
						if (data.error) {
							//pop.close();
							alert('<?php echo addslashes(__('Error during content save:','zedity'))?>\n'+data.error);
							$dialog.dialog('close');
							return;
						}
						//pop.location = 'post.php?post=679&action=edit';
						$dialog.find('.done').show().siblings().hide();
						$dialog.parent().find('button.dialog-button-close').button('enable');
						$dialog.find('.type').text(typetext);
						$dialog.find('.editlink').attr('href','post.php?post='+data.id+'&action=edit');
						if (id>=0) {
							$dialog.find('.title').text(' "'+$selected.closest('tr').find('.title').text()+'"');
						}
					},
					error: function(xhr,status,error){
						//pop.close();
						alert('<?php echo addslashes(__('Unexpected error during content save:','zedity'))?>\n'+error.toString());
					}
				});
			});
		});
		</script>
		<?php $this->additional_template_js(); ?>
	</body>
	
</html>
