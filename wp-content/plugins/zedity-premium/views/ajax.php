<?php
if (!is_user_logged_in()) {
	//user is not logged in
	$response = array('error' => __('Forbidden.','zedity'));
} if ($_SERVER['REQUEST_METHOD']=='POST' && empty($_POST) && $_SERVER['CONTENT_LENGTH']>0) {
	$response = array(
	    'error' => __('Post size may be too big','zedity') . " ({$_SERVER['CONTENT_LENGTH']})."
	);
} else if (empty($_REQUEST['zaction'])) {
	$response = array('error' => __('Malformed ajax request (missing zaction).','zedity'));
} else {

    switch ($_REQUEST['zaction']) {
		//------------------------------------------------------------------------------------
		case 'save':
			//check nonce token
			if (empty($_POST['tk']) || empty($_POST['post_id']) || !wp_verify_nonce($_POST['tk'],"zedity-save-{$_POST['post_id']}")) {
				$response = array(
					'error' => __('Invalid request.','zedity'),
					'reload' => 1
				);
				break;
			}
			//check user permission for post
			if (!current_user_can('edit_post',$_POST['post_id'])) {
				$response = array('error' => __('Forbidden.','zedity'));
				break;
			}
			if (empty($_POST['content'])) {
				$response = array('error' => __('The post content is empty.','zedity'));
				break;
			}
			if (empty($_POST['title'])) {
				$response = array('error' => __('The post title is missing.','zedity'));
				break;
			}
			$content = stripslashes($_POST['content']);
			//add prefix to the title of the Zedity content in the ML
			//this will also go into the filename (use lower case)
			$title = '[zedity] '.stripslashes($_POST['title']);

			//get upload dir
			$dir = wp_upload_dir();

			if (!empty($_POST['id']) && $_POST['id']>0) {
				//check user permission for attachment
				if (!current_user_can('edit_post',$_POST['id'])) {
					$response = array('error' => __('Forbidden.','zedity'));
					break;
				}
				$attach_id = $_POST['id'];
				//get file name
				$oldfile = get_attached_file($attach_id);
				$filename = basename($oldfile);
				$dirname = dirname($oldfile);
				$dirname = str_replace($dir['basedir'],$dirname,'');
				$dirname = str_replace($filename,$dirname,'');
				//get dir info (may be in older subdirectory)
				$dir = wp_upload_dir($dirname);
				$edit = TRUE;
			} else {
				//get unique file name from content title
				$filename = sanitize_file_name("$title.html");
				$filename = wp_unique_filename($dir['path'], "$filename");
				$edit = FALSE;
			}

			if (!is_writable($dir['path'])) {
				$response = array('error' => __('Upload directory is not writable.','zedity'));
				break;
			}

			$css = '<style>html,body{padding:0;margin:0}</style>';
			$js = '';
			if ($this->is_premium() && strpos($content,'zedity-responsive-layout')!==FALSE) {
				//responsive layout
				$js = '<script type="text/javascript" src="' . plugins_url('zedity/zedity-responsive.min.js',dirname(__FILE__)) . '"></script>';
			} else if ($this->is_premium() && strpos($content,'zedity-responsive')!==FALSE) {
				//responsive scaling
				$css .= '<style>.zedity-responsive{-webkit-transform-origin:0 0;-moz-transform-origin:0 0;-ms-transform-origin:0 0;-o-transform-origin:0 0;transform-origin:0 0}</style>';
				$js = '<script type="text/javascript">(function(){var e=document.querySelector(\'.zedity-responsive\');if(!e)return;var ow=e.offsetWidth;var oh=e.offsetHeight;var ar=false;window.onresize=(function resize(){var w=window.innerWidth/ow;var h=window.innerHeight/oh;if (ar)w=h=Math.min(w,h);var y=e.style;y.webkitTransform=y.MozTransform=y.msTransform=y.OTransform=y.transform=\'scale(\'+w+\',\'+h+\')\';return resize;})();})();</script>';
			}
			//webfonts in iframe
			if (isset($options['webfonts'])) {
				foreach ($options['webfonts'] as $font) {
					$fontname = explode(',',$font);
					$fontname = urlencode($fontname[0]);
					$css .= "<link href=\"//fonts.googleapis.com/css?family=$fontname\" rel=\"stylesheet\" type=\"text/css\">";
				}
			}
			if (isset($options['customfontscss'])) {
				$css .= "<style>{$options['customfontscss']}</style>";
			}

			//construct html
			$content = "<html><head><title>$title</title>$css</head><body>$content $js</body></html>";

			$ret = @file_put_contents("{$dir['path']}/$filename", $content);
			if ($ret===FALSE) {
				$response = array('error' => __('Error writing to file','zedity') . " ({$dir['path']}/$filename).");
				break;
			}
			$dir['url'] = str_replace(array('http://','https://'), '//', $dir['url']);

			$file['type'] = 'application/zedity';
			$file['path'] = $dir['path'];
			$file['url'] = $dir['url'];
			$file['filename'] = $filename;
			$file['full_path'] = "{$dir['path']}/$filename";
			$file['full_url'] = "{$dir['url']}/$filename";

			$attachment = array(
				'guid' => $file['full_url'],
				'post_type' => 'attachment',
				'post_title' => $title,
				'post_content' => '',
				'post_parent' => empty($_POST['post_id']) ? 0 : $_POST['post_id'],
				'post_mime_type' => $file['type'],
			);

			if ($edit) {
				$attachment['ID'] = $attach_id;
			}

			//attach
			$attach_id = wp_insert_attachment($attachment,$file['full_path']);
			//update metadata
			if (!is_wp_error($attach_id)) {
				require_once(ABSPATH . '/wp-admin/includes/image.php');
				$attachment_metadata = wp_generate_attachment_metadata($attach_id,$file['full_path']);
				$a = wp_update_attachment_metadata($attach_id,$attachment_metadata);
			}

			$response = array(
				'id' => $attach_id,
				'url' => $file['full_url'],
			);

		break;


		//------------------------------------------------------------------------------------
		case 'load':
			//check nonce token
			if (empty($_REQUEST['tk']) || empty($_REQUEST['id']) || !wp_verify_nonce($_REQUEST['tk'],"zedity-load-{$_REQUEST['id']}")) {
				$response = array('error' => __('Invalid request.','zedity'));
				break;
			}
			//check user permission for post
			if (!current_user_can('edit_post',$_REQUEST['id'])) {
				$response = array('error' => __('Forbidden.','zedity'));
				break;
			}

			$filename = get_attached_file($_REQUEST['id']);
			$content = @file_get_contents($filename);

			$response = $content === FALSE ?
				array('error' => __('Error reading file','zedity')." ($filename).") :
				array('content' => $content);
		break;

		//------------------------------------------------------------------------------------
		case 'webfonts':
			header('Content-type: text/css');
			$options = $this->get_options();
			if (isset($options['webfonts'])) {
				foreach ($options['webfonts'] as $font) {
					$fontname = explode(',',$font);
					$fontname = urlencode($fontname[0]);
					echo "@import url(\"//fonts.googleapis.com/css?family=$fontname\");\n";
				}
			}
			if (isset($options['customfontscss'])) {
				echo $options['customfontscss'];
			}
			die;
		break;

		
		//------------------------------------------------------------------------------------
		case 'addcontent':
			//check nonce token
			if (empty($_POST['tk']) || !wp_verify_nonce($_POST['tk'], "zedity-addcontent-{$_POST['type']}".(($_POST['id']<0) ? '' : "-{$_POST['id']}"))) {
				$response = array(
					'error' => __('Invalid request.','zedity'),
					'reload' => 1
				);
				break;
			}
			//check user permission for post
			if ((($_POST['id']>=0) && !current_user_can('edit_post',$_POST['id'])) || (($_POST['id']<0) && !current_user_can('edit_posts'))) {
				$response = array('error' => __('Forbidden.','zedity'));
				break;
			}
			if (empty($_POST['content'])) {
				$response = array('error' => __('The post content is empty.','zedity'));
				break;
			}
			if (empty($_POST['id'])) {
				$response = array('error' => sprintf(__('Missing %s parameter in request.','zedity'),'id'));
				break;
			}
			if (!$this->is_premium() && (($_POST['id']<0) || ($_POST['type']=='page'))) {
				$response = array('error' => __('Invalid request.','zedity'));
				break;
			}

			$content = "<p>&nbsp;</p>" . stripslashes($_POST['content']) . "<p>&nbsp;</p>";
			if ($_POST['id']<0) {
				if (empty($_POST['type'])) {
					$response = array('error' => sprintf(__('Missing %s parameter in request.','zedity'),'type'));
					break;
				}
				global $user_ID;
				//create new post
				$post_id = wp_insert_post(array(
					'post_content' => $content,
					'post_status' => 'draft',
					'post_author' => $user_ID,
					'post_type' => $_POST['type'],
				));
				if ($post_id===0) {
					$response = array('error' => __('Could not save post/page content.','zedity'));
					break;
				}
				$response = array('id' => $post_id);
			} else {
				//get post
				$post = get_post($_POST['id']);
				//add content
				if (!empty($_POST['position']) && $_POST['position']=='above') {
					$post->post_content = $content . $post->post_content;
				} else {
					$post->post_content .= $content;
				}
				//update post
				$ret = wp_update_post($post);
				if ($ret===0) {
					$response = array('error' => __('Could not save post/page content.','zedity'));
					break;
				}
				$response = array('id' => $_POST['id']);
			}
		break;
		
		//------------------------------------------------------------------------------------
		case 'closeadminnotice':
			if (empty($_POST['tk']) || !wp_verify_nonce($_POST['tk'],'zedity-closeadminnotice')) {
				$response = array('error' => __('Invalid request.','zedity'));
				break;
			}
			if (empty($_POST['dismiss'])) {
				$response = array('error' => sprintf(__('Missing %s parameter in request.','zedity'),'dismiss'));
				break;
			}
			
			//set transient for the specific message to not show it again:
			//for 12 hours if it is "remind later" for 60 days if it is "close"
			set_transient("zedity_an_dismiss_{$_POST['dismiss']}",'1', $_POST['type']=='close' ? 60*DAY_IN_SECONDS : 12*HOUR_IN_SECONDS);
			
			//clear message if it was already set
			$notices = get_option('zedity_admin_notices', array());
			if (is_array($notices)) {
				foreach ($notices as $key => $notice) {
					if ($notice[2]==$_POST['dismiss']) unset($notices[$key]);
				}
			}
			update_option('zedity_admin_notices', $notices);
			
			$response = array();
			
		break;
		
		
		//------------------------------------------------------------------------------------
		default:
			$response = array(
				'error' => __('Malformed ajax request (unknown zaction).','zedity')
			);
		break;
	} // switch
}


//return response
echo json_encode($response);






/*
if (!function_exists('wp_handle_upload')) {
	require_once(ABSPATH.'wp-admin/includes/file.php');
}

$uploadedfile = $_FILES['file'];
$movefile = wp_handle_upload($uploadedfile, array('test_form' => false));
if ($movefile) {
	echo 'OK!.\n';
	var_dump($movefile);
} else {
	echo 'Error!\n';
}
*/
