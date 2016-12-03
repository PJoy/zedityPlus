<?php
/*
Plugin Name: Zedity
Plugin URI: https://zedity.com/plugin/wp
Description: The easiest way to create your posts and pages, very quickly and with unprecedented possibilities!
Version: 7.1.3
Author: Pridea Company
Author URI: https://zedity.com
License: GPL3
License URI: https://zedity.com/license/freewp
Text Domain: zedity
*/

$path = plugin_dir_path(__FILE__);
$filepremium = "$path/premium.php";
load_plugin_textdomain('zedity', false, dirname(plugin_basename(__FILE__)).'/languages/');

//check if another Zedity plugin is already enabled
if (class_exists('WP_Zedity_Plugin')) {
	
	$thisp = get_file_data(__FILE__,array('Name' => 'Plugin Name'));
	$thisp = $thisp['Name'];
	$apl = get_option('active_plugins');
	$plugins = get_plugins();
	$activated_plugins = array();
	foreach ($apl as $p) {
		array_push($activated_plugins, $plugins[$p]);
		if (isset($plugins[$p]) && $plugins[$p]['TextDomain']=='zedity') {
			 $otherp = $plugins[$p]['Name'];
		}
	}

	$message = sprintf(__('<b>Could not activate</b> %s plugin.','zedity'),$thisp) . ' '.
		sprintf(__('You cannot activate both %s and %s plugins at the same time.','zedity'),$thisp,$otherp) . '<br/>' .
		sprintf(__('Please <b>first deactivate</b> the %s plugin, <b>then activate</b> the %s plugin.','zedity'),$otherp,$thisp);

	if (isset($_GET['action']) && $_GET['action'] == 'error_scrape') {
		echo $message;
		exit;
	} else {
		trigger_error($message, E_USER_ERROR);
	}
	
} else {



	class WP_Zedity_Plugin {
		
		const MIN_WIDTH = 50; // pixels
		const MAX_WIDTH = 2500; // pixels
		const DEFAULT_WIDTH = 600; // a typical width for some themes in wordpress
		
		const MIN_HEIGHT = 20; // pixels
		const MAX_HEIGHT = 100000; // pixels
		const DEFAULT_HEIGHT = 600;
		
		const WARNING_CONTENT_SIZE = 1000000; // 1MB (system dependent, current value based on observed cases)
		const ATTEMPT_MAX_SIZE = 10000000; // 10MB
		
		public $MAX_UPLOAD_SIZE;
		
		public function __construct() {
			register_activation_hook(__FILE__, array(&$this, 'activate'));

			$plugin = plugin_basename(__FILE__);

			//add custom css to reset Zedity content + webfonts
			add_action('wp_head', array(&$this,'add_head_css'));
			//add javascript for responsive content
			add_action('wp_print_footer_scripts', array(&$this, 'add_front_js'));

			$this->plugindata = $this->get_plugin_data();
			
			//stop here if we are not in admin area
			if (!is_admin()) return;

			// register actions
			add_action('admin_init', array(&$this, 'admin_init'));
			add_action('admin_menu', array(&$this, 'add_menu'));

			//additional links
			add_filter("plugin_action_links_$plugin", array(&$this,'settings_link'));
			add_filter('plugin_row_meta', array(&$this,'plugin_row'), 10, 2);
			
			//add javascript
			add_action('admin_print_footer_scripts', array(&$this, 'add_admin_js'));

			//capabilities filter
			add_filter('map_meta_cap', array(&$this,'fix_map_meta_cap'), 10, 4);
			//add TinyMCE css
			add_filter('mce_css', array(&$this, 'add_mce_css'));
			//add TinyMCE buttons
			add_filter('mce_buttons', array(&$this,'register_mce_buttons'));
			add_filter('mce_external_plugins', array(&$this,'add_mce_buttons'), 999);
			//TinyMCE configuration
			add_filter('tiny_mce_before_init', array(&$this,'mce_config'));

			//Zedity into ThickBox
			add_action('admin_enqueue_scripts', array(&$this,'admin_enqueue_scripts'));
			
			//use ajax mechanism to load views
			add_action('wp_ajax_zedity_editor', array(&$this,'add_zedity_editor_page'));
			add_action('wp_ajax_zedity_ajax', array(&$this,'add_zedity_ajax_page'));
			add_action('wp_ajax_zedity_template', array(&$this,'add_zedity_template_page'));

			//Zedity into Media Library
			add_filter('post_mime_types', array(&$this,'add_zedity_mime_type'));
			
			//add custom css to reset Zedity content + webfonts
			add_action('admin_head', array(&$this,'add_head_css'));
			
			//show messages
			add_action('admin_notices', array(&$this,'admin_notices'));
			
			//max upload size
			//ini_set('post_max_size',self::ATTEMPT_MAX_SIZE);
			//ini_set('upload_max_filesize',self::ATTEMPT_MAX_SIZE);
			if (function_exists('wp_max_upload_size')) {
				$this->MAX_UPLOAD_SIZE = wp_max_upload_size();
				//Note: wp_max_upload_size() does not take into account that in php.ini
				//setting 0 means unlimited. Bug on WP tracker:
				//https://core.trac.wordpress.org/ticket/23895
			} else {
				$this->MAX_UPLOAD_SIZE = self::WARNING_CONTENT_SIZE;
			}
			
			//get the environment from the file(s)
			$this->zedityServerBaseUrl = 'https://zedity.com';
			$serverUrlFile = sprintf("%s/data/serverurl.txt", dirname(__FILE__));
			if (file_exists($serverUrlFile)) {
				$this->zedityServerBaseUrl = @file_get_contents($serverUrlFile);
			}
			
			$this->promo_check();
		}
		
		public function activate($network_wide) {
			$defaults = $this->get_defaults();
			add_option($this->get_options_name(),$defaults);
		}

		
		public function is_premium() {
			return FALSE;
		}

		public function get_plugin_data() {
			return get_file_data(__FILE__,array(
				'Name' => 'Plugin Name',
				'Description' => 'Description',
				'Version' => 'Version',
				'PluginURI' => 'Plugin URI',
				'License' => 'License',
				'LicenseURI' => 'License URI',
			));
		}

		/**
		 * Show admin notice message.
		 * @param {string} $message - Message string.
		 * @param {string[]} [$pages=TRUE] - Array of pages where to show the message.
		 * @param {string} [$dismiss=FALSE] - String that identifies the message.
		 */
		public function show_message($message, $pages=TRUE, $dismiss=FALSE) {
			$notices = get_option('zedity_admin_notices', array());
			if ($dismiss!==FALSE) {
				//if this message was already dismissed then exit
				if (get_transient("zedity_an_dismiss_$dismiss")!==FALSE) return;
			}
			$newmsg = array($message,$pages,$dismiss);
			if (!in_array($newmsg,$notices)) $notices[] = $newmsg;
			update_option('zedity_admin_notices', $notices);
		}

		public function admin_notices() {
			global $pagenow;
			$notices = get_option('zedity_admin_notices', array());
			foreach ($notices as $notice) {
				if (is_string($notice)) $notice = array($notice,TRUE);
				if (!is_array($notice)) continue;
				if ($notice[1]===TRUE || in_array($pagenow,$notice[1])) {
					$msg = "<div class='zedity-admin-notice updated'>{$notice[0]}";
					if ($notice[2]) {
						//show "remind later" and "close" buttons
						$msg .= "<p><button class='button zedity-notice-close' data-type='close' data-dismiss='{$notice[2]}'>".__('No, thanks','zedity')."</button> <button class='button zedity-notice-close' data-type='remind' data-dismiss='{$notice[2]}'>".__('Remind me later','zedity')."</button></p>";
					}
					$msg .= '</div>';
					echo $msg;
				}
			}
			delete_option('zedity_admin_notices');
		}
		
		public function version_check(){
			$version = array();
			$version['latest'] = get_site_transient('zedity_latest_version');
			if ($version['latest']===FALSE) {
				if (!function_exists('plugins_api')) require_once(ABSPATH.'wp-admin/includes/plugin-install.php');
				$call_api = plugins_api('plugin_information', array('slug'=>'zedity','fields'=>array('version'=>true)));
				if (!is_wp_error($call_api) && !empty($call_api->version)) $version['latest'] = $call_api->version;
				if (!empty($version['latest'])) set_site_transient('zedity_latest_version',$version['latest'],86400);
			}
			$version['installed'] = $this->plugindata['Version'];
			$version['update_available'] = empty($version['latest']) ? 'error' : version_compare($version['installed'], $version['latest'], '<');
			$version['message'] = $version['update_available']===TRUE ?
					sprintf(__('There is a new update available (%s), please %s.','zedity'),$version['latest'],"<b>".__('update now','zedity').'</b>') :
					($version['update_available']===FALSE ? __('You have the latest version.','zedity') : ''); //do not change 'update now', used in version_check in premium.php
			$version['class'] = $version['update_available']===TRUE ? 'update' : ($version['update_available']===FALSE ? 'ok' : 'error');
			return $version;
		}
		
		public function promo_check(){
			//check if promo is available
			if (($promocode = get_site_transient('zedity_promo'))===FALSE) {
				//call API on zedity site
				$request = wp_remote_get("{$this->zedityServerBaseUrl}/plugin/wppromo");
				if (!is_wp_error($request) && wp_remote_retrieve_response_code($request)==200) {
					$promocode = wp_remote_retrieve_body($request);
				} else {
					$promocode = '';
				}
				//set promo in a transient, expire in 8 hours
				set_site_transient('zedity_promo', $promocode, 8 * HOUR_IN_SECONDS);
			}
			$message = '';
			if (!empty($promocode)) {
				$message = sprintf(__('%s is available at a discounted price for a limited time only!','zedity'),'<b>Zedity Premium</b>') . '<br/>' .
					sprintf(__('Grab it now at %s by using the promo code "%s".','zedity'), "<a target=\"_blank\" href=\"{$this->zedityServerBaseUrl}/plugin/wp\">zedity.com</a>","<b>$promocode</b>");
				$this->show_message(
					"<p>$message</p>",
					array('plugins.php'),
					"promo-$promocode"
				);
			}
			return array(
				'promocode' => $promocode,
				'message' => $message,
			);
		}
		
		public function open_editor(){
		}
		
		//----------------------------------------------------------------------------------------------
		//VIEWS


		public function admin_init() {
			register_setting('wp_zedity_plugin', $this->get_options_name(), array($this,'zedity_settings_validate'));
			add_settings_section('zedity_main', 'Page', array($this,'section_zedity_page'), 'zedity_settings_section');
		}

		public function add_menu() {
			add_options_page('Zedity Settings', 'Zedity Editor', 'manage_options', 'wp_zedity_plugin', array(&$this, 'add_settings_page'));
		}
		

		function add_zedity_mime_type($post_mime_types) {
			$post_mime_types['application/zedity'] = array('Zedity', sprintf(__('Manage %s contents','zedity'),'Zedity'), _n_noop('Zedity <span class="count">(%s)</span>','Zedity <span class="count">(%s)</span>'));
			return $post_mime_types;
		}


		//----------------------------------------------------------------------------------------------
		//EDITOR


		public function add_zedity_editor_page() {
			if (!empty($_REQUEST['data']) && $_REQUEST['data']=='saved') {
				//get data when ajax request is redirected with 302 Moved Temporarily
				$attachments = get_posts(array(
					'post_type' => 'attachment',
					'posts_per_page' => 1,
					'post_status' => null,
					'post_mime_type' => 'application/zedity',
				));
				if (!empty($attachments[0])) {
					$id = isset($attachments[0]->ID) ? $attachments[0]->ID : NULL;
					$url = isset($attachments[0]->guid) ? $attachments[0]->guid : NULL;
					if (empty($id) || empty($url)) {
					    $response = array('error' => sprintf(__('Save content: empty id (%s) or url (%s).','zedity'),$id,$url));
					} else {
					    $response = array('id' => $id, 'url' => $url);
					}
				} else {
					$response = array('error' => __('Save content: could not find attachment.','zedity'));
				}
				echo json_encode($response);
				exit;
			}

			require(ABSPATH . WPINC . '/version.php');
			$options = $this->get_options();
			header('Content-Type: text/html');
			include(sprintf("%s/views/editor.php", dirname(__FILE__)));
			exit;
		}

		public function add_zedity_ajax_page() {
			require(ABSPATH . WPINC . '/version.php');
			$options = $this->get_options();
			header('Content-Type: application/json');
			include(sprintf("%s/views/ajax.php", dirname(__FILE__)));
			exit;
		}
		
		public function add_zedity_template_page() {
			require(ABSPATH . WPINC . '/version.php');
			$options = $this->get_options();
			header('Content-Type: text/html');
			include(sprintf("%s/views/template.php", dirname(__FILE__)));
			exit;
		}

		//----------------------------------------------------------------------------------------------
		//JAVASCRIPT

		public function add_admin_js(){
			?>
			<script type="text/javascript">
			jQuery(document).ready(function(){
				jQuery('.zedity-notice-close').on('click',function(){
					var $this = jQuery(this);
					var dismiss = $this.attr('data-dismiss');
					var type = $this.attr('data-type');
					jQuery.ajax({
						url: 'admin-ajax.php?action=zedity_ajax',
						type: 'POST',
						data: {
							zaction: 'closeadminnotice',
							tk: '<?php echo wp_create_nonce('zedity-closeadminnotice') ?>',
							type: type,
							dismiss: dismiss
						}
					});
					$this.closest('.zedity-admin-notice').slideUp();
					return false;
				});

				if (!window.tinyMCE) return;
				
				tinyMCE.addI18n({'<?php echo (class_exists('_WP_Editors') ? _WP_Editors::$mce_locale : substr(WPLANG,0,2)) ?>': {
					zedity: {
						premium: '<?php echo $this->is_premium() ? 'yes' : 'no'?>',
						need_premium: '<?php echo sprintf(addslashes(__('This content was created using %s. You need %s to edit this content.','zedity')),'Zedity Premium','Zedity Premium')?>',
						edit_content: '<?php echo sprintf(addslashes(__('Edit %s content','zedity')),'Zedity')?>',
						copy_content: '<?php echo sprintf(addslashes(__('Copy this %s content into another post or page','zedity')),'Zedity')?>',
						delete_content: '<?php echo sprintf(addslashes(__('Delete %s content','zedity')),'Zedity')?>',
						copy_content_title: '<?php echo sprintf(addslashes(__('%s Content Duplication','zedity')),'Zedity')?>',
					}
				}});
				
				window.zedityLightbox = {
					lightbox: null,
					iframe: null,
					open: function(url){
						this.lightbox = jQuery(
							'<div class="zedity-lightbox">'+
								'<button class="zedity-lightbox-close">&times;</button>'+
								'<div class="zedity-lightbox-content">'+
									'<iframe class="zedity-lightbox-iframe"/>'+
								'</div>'+
							'</div>'
						);
						this.lightbox.find('.zedity-lightbox-iframe').on('load',jQuery.proxy(function(){
							this.lightbox.addClass('loaded');
						},this)).attr('src',url);
						this.lightbox.find('.zedity-lightbox-close').andSelf().on('click',jQuery.proxy(function(){
							this.close();
							return false;
						},this));
						jQuery('body').addClass('zedity-open').append(this.lightbox);
						this.iframe = this.lightbox.find('iframe')[0];
						return true;
					},
					close: function(){
						if (this.iframe.contentWindow.zedityEditor && this.iframe.contentWindow.zedityEditor.contentChanged) {
							var ret = confirm(
								'<?php echo addslashes(__('You haven\'t saved your modifications!','zedity'))?>'+
								'\n\n'+
								'<?php echo addslashes(__('To save changes, click on Cancel and then select Content->Save from the menu.','zedity'))?>'+
								'\n\n'+
								'<?php echo sprintf(addslashes(__('To discard the modifications and close the %s, click OK.','zedity')),'Zedity editor')?>'
							);
							if (!ret) return;
						}
						this.lightbox.remove();
						jQuery('body').removeClass('zedity-open');
						var ed = tinyMCE.activeEditor;
						if (ed && ed.plugins.zedity) ed.plugins.zedity._closeZedity();
					}
				};
				
				window.askPublish = function(){
					if (!window.tinyMCE || !tinyMCE.get('content')) return;
					jQuery(
						'<div><p>'+
						'<?php echo sprintf(addslashes(__('You have modified your %s content.','zedity')),'Zedity')?>'+
						'</p><p>'+
						'<?php echo addslashes(__('Please don\'t forget to publish your post for the modifications to appear in your published post as well.','zedity'))?>'+
						'</p></div>'
					).dialog({
						title: 'Zedity',
						dialogClass: 'zedity-dialog',
						autoOpen: true,
						modal: true,
						resizable: false,
						close: function(){
							jQuery(this).dialog('destroy').remove();
						},
						buttons: [{
							text: '<?php echo addslashes(__('Publish now','zedity'))?>',
							click: function(){
								jQuery(this).dialog('close');
								jQuery('#publish').trigger('click');
							}
						},{
							text: '<?php echo addslashes(__('Publish later','zedity'))?>',
							click: function(){
								jQuery(this).dialog('close');
							}
						}]
					});
				};
			});
			</script>
			<?php
		}
		
		public function additional_editor_js($options){
			?>
			<script type="text/javascript" src="<?php echo plugins_url("zedity/zedity.promo.js?{$this->plugindata['Version']}", __FILE__);?>"></script>
			<?php
		}
		
		public function additional_template_js(){
			?>
			<script type="text/javascript">
			$(function(){
				$.widget('ui.tooltip',$.ui.tooltip,{options:{content:function(){return $(this).prop('title')}}});
				var keepTooltipOpen = function(event){
					var $target = $(event.target);
					if (!$target.hasClass('zedity-promo')) $target = $target.parents('.zedity-promo');
					if ($target.length==0) return;
					event.stopImmediatePropagation();
					var fixed = setTimeout(function(){$target.tooltip('close')},200);
					$('.ui-tooltip').hover(function(){clearTimeout(fixed)},function(){$target.tooltip('close')});
					false;
				};
				//disable unavailable options
				$('#tabs').tabs('option','disabled',[1]);
				$('table.posts tr.new').addClass('disabled');
				//add promo tooltips
				var link = '<?php echo sprintf(addslashes(__('For information or to upgrade to %s, please visit %s.','zedity')),'Zedity Premium','<a href="https://zedity.com/plugin/wp" target="_blank">zedity.com</a>');?>';
				$('a[href="#tab-pages"]').addClass('zedity-promo')
					.attr('title','<?php echo sprintf(addslashes(__('%s feature: copy content into a page.','zedity')),'Premium')?><br/>'+link)
					.tooltip({show:{delay:750}}).on('mouseleave',keepTooltipOpen);
				$('table.posts.above').addClass('zedity-promo')
					.attr('title','<?php echo sprintf(addslashes(__('%s feature: copy content into a new post.','zedity')),'Premium')?><br/>'+link)
					.tooltip({show:{delay:750}}).on('mouseleave',keepTooltipOpen);
			});
			</script>
			<?php
		}
		
		public function add_front_js(){
			if (is_admin()) return;
			$options = $this->get_options();
			?>
			<script type="text/javascript">
				(function zedityResponsive(){var old_resize = window.onresize||function(){};window.onresize=(function resize(){
				old_resize.apply(this,arguments);var e=document.querySelectorAll('.zedity-editor.zedity-responsive');for(var i=e.length-1;i>=0;--i){var pw=e[i].parentNode.offsetWidth;var origW=e[i].getAttribute('data-origw');var origH=e[i].getAttribute('data-origh');var ph,s;if(origH && origW>pw){var r=pw/origW;s='scale('+r+')';ph=origH*r+'px';}else{ph=s='';}e[i].style.webkitTransform=e[i].style.MozTransform=e[i].style.msTransform=e[i].style.OTransform=e[i].style.transform=s;e[i].parentNode.style.height=ph;}
				<?php if (!$options['responsive_noconflict']) { ?>
				e=document.querySelectorAll('.zedity-responsive > iframe');for(var i=e.length-1;i>=0;--i){var pw=e[i].parentNode.offsetWidth;var ow=e[i].parentNode.getAttribute('data-origw');var oh=e[i].parentNode.getAttribute('data-origh');if(oh&&ow&&pw<ow){e[i].style.width=pw+'px';e[i].style.height=Math.round(oh*pw/ow)+'px';}}
				<?php } ?>
				return resize;})();})();
			</script>
			<script type="text/javascript" src="<?php echo plugins_url("zedity/zedity-responsive.min.js?{$this->plugindata['Version']}", __FILE__);?>" async></script>
			<?php
		}
		
		public function admin_enqueue_scripts() {
			//ThickBox
			wp_enqueue_script('thickbox');
			//jQueryUI dialog and dependencies
			wp_enqueue_script('jquery-ui-dialog');
		}


		//----------------------------------------------------------------------------------------------
		//TINYMCE

		public function fix_map_meta_cap($caps, $cap, $user_id, $args) {
			//ensure that unfiltered_html capability is honored
			if ($cap=='unfiltered_html') {
				$user = get_user_by('id',$user_id);
				if (!empty($user->allcaps['unfiltered_html']) && $user->allcaps['unfiltered_html']) {
					$caps = array($cap);
				}
			}
			return $caps;
		}

		public function register_mce_buttons($buttons) {
			if (!current_user_can('unfiltered_html')) return $buttons;
			
			$buttons[] = 'zedity';
			return $buttons;
		}


		public function add_mce_buttons($plugins) {
			if (!current_user_can('unfiltered_html')) return $plugins;
			
			$plugins['zedity'] = plugins_url("mce/zedity-mce-button.js?{$this->plugindata['Version']}", __FILE__);
			$options = $this->get_options();
			if ($options['iframe_preview']) {
				//include custom media plugin for iframe preview
				$plugins['newmedia'] = plugins_url("mce/media/editor_plugin.js?{$this->plugindata['Version']}", __FILE__);
			}
			//include custom noneditable plugin to disallow Zedity content edit inside TinyMCE
			$plugins['newnoneditable'] = plugins_url("mce/noneditable/editor_plugin.js?{$this->plugindata['Version']}", __FILE__);
			return $plugins;
		}


		public function add_mce_css($mce_css) {
			if (!current_user_can('unfiltered_html')) return $mce_css;
			
			if (!empty($mce_css)) $mce_css .= ',';
			$mce_css .= plugins_url("mce/mce-editor-zedity.css?{$this->plugindata['Version']}", __FILE__) . ',';
			$mce_css .= plugins_url("mce/content-overlay.css?{$this->plugindata['Version']}", __FILE__) . ',';
			$mce_css .= plugins_url("css/zedity-reset.css?{$this->plugindata['Version']}", __FILE__) . ',';
			$mce_css .= 'admin-ajax.php?action=zedity_ajax&zaction=webfonts';
			return $mce_css;
		}
		
		public function mce_config($init) {
			if (empty($init)) return;
			if (!current_user_can('unfiltered_html')) return $init;
			
			//ensure that iframes and styles are allowed
			$elems = 'iframe[*],style[*]';
			if (!isset($init['extended_valid_elements'])) {
				$init['extended_valid_elements'] = $elems;
			} else {
				$init['extended_valid_elements'] .= ",$elems";
			}
			//ensure style tag is allowed in body and divs
			$child = '+body[style],+div[style]';
			if (!isset($init['valid_children'])) {
				$init['valid_children'] = $child;
			} else {
				$init['valid_children'] .= ",$child";
			}
			$options = $this->get_options();
			
			if (!empty($init['plugins'])) {
				//disable conflicting tinymce plugins
				$plugins = explode(',',$init['plugins']);
				$plugins = array_diff($plugins, array('noneditable','-noneditable'));
				if ($options['iframe_preview']) {
					$plugins = array_diff($plugins, array('media','-media'));
				}
				$init['plugins'] = implode(',',$plugins);
			}
			return $init;
		}




		//----------------------------------------------------------------------------------------------
		//SETTINGS

		
		public function get_defaults(){
			return array(
				'save_mode' => 2,
				'page_width' => self::DEFAULT_WIDTH,
				'page_height' => self::DEFAULT_HEIGHT,
				'add_blank_lines' => TRUE,
				'webfonts' => array(),
				'watermark' => 'none',
				'customfontscss' => '',
				'customfonts' => array(),
				'responsive' => 0,
				'responsive_noconflict' => FALSE,
				'iframe_preview' => TRUE,
				'snap_to_page' => FALSE,
				'snap_to_boxes' => FALSE,
				'snap_to_grid' => FALSE,
				'grid_width' => 100,
				'grid_height' => 100,
			);
		}
		
		public function get_options_name(){
			return 'zedity_settings';
		}
		
		public function get_options(){
			$options = get_option($this->get_options_name(),array());
			//convert from old versions
			if (isset($options['responsive']) && $options['responsive']===FALSE) $options['responsive']=0;
			$defaults = $this->get_defaults();
			return array_merge($defaults,$options);
		}

		public function add_settings_page() {
			if (!current_user_can('manage_options')) {
				wp_die(__('You do not have sufficient permissions to access this page.'));
			}
			$options = $this->get_options();
			//Render the settings template
			include(sprintf("%s/views/settings.php", dirname(__FILE__)));
		}


		// Add a link to the settings page onto the plugin page
		public function settings_link($links) {
			$settings_link = '<a href="options-general.php?page=wp_zedity_plugin">'.__('Settings').'</a>';
			array_unshift($links, $settings_link);
			return $links;
		}

		public function plugin_row($links,$file) {
			if ($file == plugin_basename(__FILE__)) {
				//Add "Rate Zedity!" link
				$links[] = '<a class="button" href="https://wordpress.org/support/view/plugin-reviews/zedity" target="_blank">'.sprintf(__('Rate %s!','zedity'),'Zedity').'</a>';
				//Add "Donate" and "Get Premium" links if it is not Premium
				if (!$this->is_premium()) {
					$links[] = '<a class="button" href="https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=WXNQFRAGR5WKQ" target="_blank">'.__('Donate','zedity').'</a>';
					
					$promo = $this->promo_check();
					$title = ($promo['promocode'] ? 'title="'.sprintf(__('Use promo code: %s','zedity'),$promo['promocode']).'"' : '');
					$links[] = '<a class="button" href="'.$this->plugindata['PluginURI']."\" target=\"_blank\" $title>".
							sprintf(__('Get %s','zedity'),'Zedity Premium').
							($promo['promocode'] ? '<br/>'.__('at a discounted price!','zedity') : '').
							'</a>';
				}
			}
			return $links;
		}

		//Validation
		public function zedity_settings_validate($input) {
			$options = $this->get_options();
			
			$options['save_mode'] = $input['save_mode'];
			if ($options['save_mode']!=1 and $options['save_mode']!=2) $options['save_mode'] = 1;

			$options['page_width'] = trim($input['page_width']);
			if (!preg_match('/^[0-9]{3,5}$/i', $options['page_width'])) {
				$options['page_width'] = self::DEFAULT_WIDTH;
			}
			if ($options['page_width']<self::MIN_WIDTH) {
				$options['page_width'] = self::MIN_WIDTH;
			}
			if ($options['page_width']>self::MAX_WIDTH) {
				$options['page_width'] = self::MAX_WIDTH;
			}
			
			$options['page_height'] = trim($input['page_height']);
			if (!preg_match('/^[0-9]{3,5}$/i', $options['page_height'])) {
				$options['page_height'] = self::DEFAULT_HEIGHT;
			}
			if ($options['page_height']<self::MIN_WIDTH) {
				$options['page_height'] = self::MIN_HEIGHT;
			}
			if ($options['page_height']>self::MAX_WIDTH) {
				$options['page_height'] = self::MAX_HEIGHT;
			}
			
			$options['add_blank_lines'] = !empty($input['add_blank_lines']);
			
			$options['webfonts'] = array();
			if (isset($input['webfonts'])) {
				foreach ($input['webfonts'] as $font){
					$options['webfonts'][] = $font;
				}
			}
			
			$allowed = array('none','topleft','topright','bottomleft','bottomright');
			$options['watermark'] = 'none';
			if (in_array($input['watermark'],$allowed)) {
				$options['watermark'] = $input['watermark'];
			}

			$options['iframe_preview'] = ($input['iframe_preview'] == 1);
			
			return $options;
		}
		
		public function additional_settings_page($options){
		}



		//----------------------------------------------------------------------------------------------
		//HEAD CSS


		public function add_head_css() {
			$options = $this->get_options();
			?>
			<link rel="stylesheet" href="<?php echo plugins_url("css/zedity-reset.css?{$this->plugindata['Version']}", __FILE__); ?>" type="text/css" media="all" />
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
			if (is_admin()) {
				global $post;
				if (!empty($post)) {
					?><script type="text/javascript">window.post_id = <?php echo $post->ID ?>;</script><?php
				}
				//add thickbox css here because using wp_enqueue_style() or add_thickbox() breaks RTL
				?>
				<link rel="stylesheet" href="<?php echo get_bloginfo('wpurl')?>/wp-includes/js/thickbox/thickbox.css" type="text/css" />
				<link rel="stylesheet" href="<?php echo plugins_url("css/zedity-admin.css?{$this->plugindata['Version']}", __FILE__)?>" type="text/css" media="all" />
				<?php
			}
		}
		
		
		
		//--------------------------------------------------------------------------------

		
		public function get_font_sizes(){
			return array('11','12','14','16','19','21','24','27','29','32','37','48','53','64');
		}
		
		public function get_webfonts(){
			return array(
				'Caesar Dressing,cursive',
				'Crafty Girls,cursive',
				'Jacques Francois,serif',
				'Quintessential,cursive',
			);
		}
		
		public function get_videoembeds(){
			return array(
				'youtube' => 'http://www.youtube.com',
				'vimeo' => 'http://vimeo.com',
			);
		}

		public function get_audioembeds(){
			return array(
				'soundcloud' => 'http://soundcloud.com',
				'reverbnation' => 'http://www.reverbnation.com',
			);
		}
		
	}

	
	if (file_exists($filepremium)) {
		require_once($filepremium);
		$wp_zedity_plugin = new WP_Zedity_Plugin_Premium();
	} else {
		$wp_zedity_plugin = new WP_Zedity_Plugin();
	}
	
}
