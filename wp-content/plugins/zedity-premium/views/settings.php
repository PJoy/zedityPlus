<?php
	if (!isset($options['webfonts'])) $options['webfonts'] = array();

	$allwebfonts = $this->get_webfonts();
	foreach ($allwebfonts as $font) {
		$fontname = explode(',',$font);
		$fontname = urlencode($fontname[0]);
		?>
		<link href='//fonts.googleapis.com/css?family=<?php echo $fontname?>' rel='stylesheet' type='text/css'>
		<?php
	}
	
	$settings = $this->get_options_name();
?>

<div class="wrap">
	<?php screen_icon(); ?>
	<h2><?php echo sprintf(__('%s Settings','zedity'),'Zedity')?></h2>

	<form action="options.php" method="post">
		<hr/>
		<h3 class="title"><?php _e('Content save mode','zedity')?></h3>
		<p><?php echo sprintf(__('Choose the way your %s contents are saved.','zedity'),'Zedity')?></p>
		<p>
			<?php _e('<b>Isolated mode</b>: the HTML content is saved into a file in your Media Library and loaded inside an iframe into your page. This is useful to prevent the theme or other plugins from causing undesired modifications to your designs.','zedity')?><br/>
			<?php _e('<b>Standard mode</b>: the HTML content is saved inline, just like if it was created with the WordPress editor (and, as such, other plugins or the theme may modify it). This is the preferred mode for SEO and social sharing.','zedity')?>
		</p>
		<table class="form-table"><tbody>
			<tr valign="top">
				<th scope="row"><?php _e('Save mode:','zedity')?></th>
				<td>
					<input type="radio" id="zedity_save_iframe" name="<?php echo $settings?>[save_mode]" value="1" <?php echo $options['save_mode']==1?'checked="checked"':''?> /><label for="zedity_save_iframe"><?php _e('Isolated mode.','zedity')?></label><br/>
					<input type="radio" id="zedity_save_inline" name="<?php echo $settings?>[save_mode]" value="2" <?php echo $options['save_mode']==2?'checked="checked"':''?> /><label for="zedity_save_inline"><?php _e('Standard mode.','zedity')?></label><br/>
				</td>
			</tr>
		</tbody></table>
		
		<hr/>
		<h3 class="title"><?php _e('Content size','zedity')?></h3>
		<p><?php echo sprintf(__('Enter the default size (in pixels) for your %s contents (you can also change the size while editing):','zedity'),'Zedity')?></p>
		<table class="form-table"><tbody>
			<tr valign="top">
				<th scope="row"><label for="zedity_page_width"><?php _e('Content width:','zedity')?></label></th>
				<td>
					<input id="zedity_page_width" name="<?php echo $settings?>[page_width]" size="5" maxlength="5" type="text" value="<?php echo $options['page_width']?>" />
					(<?php echo self::MIN_WIDTH.'-'.self::MAX_WIDTH?>), <?php _e('numbers only.','zedity')?>
				</td>
			</tr>
			<tr valign="top">
				<th scope="row"><label for="zedity_page_height"><?php _e('Content height:','zedity')?></label></th>
				<td>
					<input id="zedity_page_height" name="<?php echo $settings?>[page_height]" size="5" maxlength="5" type="text" value="<?php echo $options['page_height']?>" />
					(<?php echo self::MIN_HEIGHT.'-'.self::MAX_HEIGHT?>), <?php _e('numbers only.','zedity')?>
				</td>
			</tr>
		</tbody></table>

		<hr/>
		<h3 class="title"><?php _e('Content preview','zedity')?></h3>
		<p><?php echo sprintf(__('Enable or disable the %s content preview (this only applies for Isolated save mode).','zedity'),'Zedity')?></p>
		<table class="form-table"><tbody>
			<tr valign="top">
				<th scope="row"><label><?php _e('Preview:','zedity')?></label></th>
				<td>
					<input type="radio" id="rbPreviewYes" name="<?php echo $settings?>[iframe_preview]" value="1" <?php echo $options['iframe_preview']?'checked="checked"':'' ?> /><label for="rbPreviewYes"> <?php _e('Yes','zedity')?></label> &nbsp;
					<input type="radio" id="rbPreviewNo" name="<?php echo $settings?>[iframe_preview]" value="0" <?php echo !$options['iframe_preview']?'checked="checked"':'' ?> /><label for="rbPreviewNo"> <?php _e('No','zedity')?></label>
				</td>
			</tr>
		</tbody></table>
		
		<hr/>
		<h3 class="title"><?php _e('Content space','zedity')?></h3>
		<p><?php echo sprintf(__('Add a blank line above and below the %s contents when saving.','zedity'),'Zedity')?></p>
		<table class="form-table"><tbody>
			<tr valign="top">
				<th scope="row"><label><?php _e('Space:','zedity')?></label></th>
				<td>
					<input type="radio" id="rbBlankLinesYes" name="<?php echo $settings?>[add_blank_lines]" value="1" <?php echo $options['add_blank_lines']?'checked="checked"':'' ?> /><label for="rbBlankLinesYes"> <?php _e('Yes','zedity')?></label> &nbsp;
					<input type="radio" id="rbBlankLinesNo" name="<?php echo $settings?>[add_blank_lines]" value="0" <?php echo !$options['add_blank_lines']?'checked="checked"':'' ?> /><label for="rbBlankLinesNo"> <?php _e('No','zedity')?></label>
				</td>
			</tr>
		</tbody></table>
		
		<hr/>
		<p><?php _e('Some themes/plugins provide responsiveness for iframes. In such cases, you may need to enable the "No conflict mode" option here (this only applies for isolated save mode):','zedity')?></p>
		<table class="form-table"><tbody>
			<tr valign="top">
				<th scope="row"><label><?php _e('No conflict mode:','zedity')?></label></th>
				<td>
					<input type="radio" id="rbResponsiveNcOn" name="<?php echo $settings?>[responsive_noconflict]" value="1" <?php echo $options['responsive_noconflict']?'checked="checked"':'' ?> /><label for="rbResponsiveNcOn"> <?php _e('On','zedity')?></label> &nbsp;
					<input type="radio" id="rbResponsiveNcOff" name="<?php echo $settings?>[responsive_noconflict]" value="0" <?php echo !$options['responsive_noconflict']?'checked="checked"':'' ?> /><label for="rbResponsiveNcOff"> <?php _e('Off','zedity')?></label>
				</td>
			</tr>
		</tbody></table>
		
		<h3 class="title"><?php _e('Watermark','zedity')?></h3>
		<p><?php echo sprintf(__('If you like %s, a simple way for you to support it is to enable the "%s" watermark.','zedity'),'Zedity','Powered by Zedity')?></p>
		<p><?php _e('Select the default watermark position, which can also be changed while creating content (under the "Content" menu):','zedity')?></p>

		<div style="border:2px solid #ccc;width:500px;height:100px;padding:5px">
			<input type="radio" name="<?php echo $settings?>[watermark]" id="rbWM1" value="none" <?php echo ($options['watermark']=='none' ? 'checked="checked"':'') ?>>
			<label for="rbWM1"><?php _e('Disabled (no watermark is shown)','zedity')?></label><br/>
			<input type="radio" name="<?php echo $settings?>[watermark]" id="rbWM2" value="topleft" <?php echo ($options['watermark']=='topleft' ? 'checked="checked"':'') ?>>
			<label for="rbWM2"><?php _e('Top left','zedity')?></label><br/>
			<input type="radio" name="<?php echo $settings?>[watermark]" id="rbWM3" value="topright" <?php echo ($options['watermark']=='topright' ? 'checked="checked"':'') ?>>
			<label for="rbWM3"><?php _e('Top right','zedity')?></label><br/>
			<input type="radio" name="<?php echo $settings?>[watermark]" id="rbWM4" value="bottomleft" <?php echo ($options['watermark']=='bottomleft' ? 'checked="checked"':'') ?>>
			<label for="rbWM4"><?php _e('Bottom left','zedity')?></label><br/>
			<input type="radio" name="<?php echo $settings?>[watermark]" id="rbWM5" value="bottomright" <?php echo ($options['watermark']=='bottomright' ? 'checked="checked"':'') ?>>
			<label for="rbWM5"><?php _e('Bottom right','zedity')?></label><br/>
		</div>
		<br/>
		
		<hr/>

		<h3 class="title"><?php _e('Media embed','zedity')?></h3>
		<p><?php _e('Supported media embed services.','zedity')?></p>

		<table class="form-table"><tbody>
			<tr valign="top">
				<th scope="row"><label><?php _e('Video:','zedity')?></label></th>
				<td>
					<?php
					$content = array();
					foreach($this->get_videoembeds() as $service=>$site) {
						$content[] = "<a href=\"$site\" target=\"_blank\">$service</a>";
					}
					echo implode(', ',$content);
					?>
				</td>
			</tr>
			<tr valign="top">
				<th scope="row"><label><?php _e('Audio:','zedity')?></label></th>
				<td>
					<?php
					$content = array();
					foreach($this->get_audioembeds() as $service=>$site) {
						$content[] = "<a href=\"$site\" target=\"_blank\">$service</a>";
					}
					echo implode(', ',$content);
					?>
				</td>
			</tr>
		</tbody></table>

		<br/>

		<?php if (!$this->is_premium()) { ?>
			<p><?php echo sprintf(__('Get %s with support to 20+ video and audio services embeds.','zedity'),"<a href=\"{$this->plugindata['PluginURI']}\" target=\"_blank\">Zedity Premium</a>")?></p>
		<?php } ?>
		
		<hr/>

		
		<h3 class="title"><?php _e('Web fonts','zedity')?></h3>
		<p><?php _e('In addition to the standard fonts, you can select any of the following web fonts, to give your content a distinctive style:','zedity')?></p>
		<p><?php echo sprintf(__('(<b>Note:</b> web fonts are loaded from %s service. Enabling many web fonts at once may result in slower page load.)','zedity'),'<a href="http://www.google.com/fonts" target="_blank">Google Fonts</a>')?></p>
		<div style="border:2px solid #ccc;width:300px;height:200px;overflow-y:scroll;padding:5px">
			<?php
				$i = 0;
				foreach ($allwebfonts as $font) {
					$i++;
					$fontname = explode(',',$font);
					$fontname = $fontname[0];
					?>
					<input type="checkbox" id="cbWB_<?php echo $i ?>" name="<?php echo $settings?>[webfonts][]" value="<?php echo $font ?>" <?php checked(in_array($font,$options['webfonts'])); ?>/>
					<label for="cbWB_<?php echo $i ?>" style="font:16px <?php echo $font ?>"><?php echo $fontname ?></label>
					<br />
			<?php } ?>
		</div>
	
		<?php if (!$this->is_premium()) { ?>
			<p><?php echo sprintf(__('Get %s with support to 100+ web fonts.','zedity'),"<a href=\"{$this->plugindata['PluginURI']}\" target=\"_blank\">Zedity Premium</a>")?></p>
		<?php } ?>

		<hr/>

		<?php $this->additional_settings_page($options); ?>
		
		<h4 class="title"><?php _e('License','zedity')?></h4>
		<p><?php echo sprintf(__('The %s WP plugin is available under the %s license.','zedity'),$this->plugindata['Name'],"<a href=\"{$this->plugindata['LicenseURI']}\">{$this->plugindata['License']}</a>")?></p>
		
		<?php
			settings_fields('wp_zedity_plugin');
			do_settings_fields('wp_zedity_plugin','zedity_settings');
			submit_button();
		?>
	</form>
</div>
