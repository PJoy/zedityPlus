<?php
/*****************************************************************************************

	img2b64
	-------

	Image to base64 converter web service.
	Takes an image in upload and converts it to base64.

	INPUT

	fileupload = name of file input tag, if not set tries to find it

	Optional:
	width = width to resize the image to
	height = height to resize the image to


	OUTPUT (json)

	{
		"mime" : "image/jpeg",
		"data" : "data:image/jpeg;base64,jl87IGYbjgj3h...",
		"width" : 450,
		"height" : 200,
		"status" : "OK",
		"message" : "OK"
	}

	If status="ERROR", then message contains the error message and other
	fields are not set

	REQUIREMENTS

	- PHP 5+
	- GD extension
	


*****************************************************************************************/

	//CONFIGURATION

	//10MB max filesize (keep it in sync with maxSize in editor.php
	define('MAX_FILESIZE',10485760);

	
	//END CONFIGURATION
	
/****************************************************************************************/
	
	
	//error_reporting(0);
	ini_set('post_max_size',MAX_FILESIZE);
	ini_set('upload_max_filesize',MAX_FILESIZE);


	//check if request was dropped by the size limit
	if (empty($_FILES)) {
		echo <<<END
			{
				"status" : "ERROR",
				"message" : "File too big."
			}
END;
		die;
	}


	//find file input tag
	if (!isset($_REQUEST['fileupload'])) {
		$ta = array_keys($_FILES);
		if (count($ta)>0) {
			$_REQUEST['fileupload'] = $ta[0];
		} else {
			echo <<<END
				{
					"status" : "ERROR",
					"message" : "Could not find file upload tag name."
				}
END;
			die;
		}
	}

	//check if upload is successful
	if (($_FILES[$_REQUEST['fileupload']]['error']!==UPLOAD_ERR_OK) || !is_uploaded_file($_FILES[$_REQUEST['fileupload']]['tmp_name'])) {
		echo <<<END
			{
				"status" : "ERROR",
				"message" : "Upload failed."
			}
END;
		die;
	}

	//get info
	$fn = $_FILES[$_REQUEST['fileupload']]['tmp_name'];

	//double-check image file size
	if (filesize($fn)>MAX_FILESIZE) {
		echo <<<END
			{
				"status" : "ERROR",
				"message" : "File too big."
			}
END;
		die;
	}

	//get image info
	$info = getimagesize($fn);
	$width = $info[0];
	$height = $info[1];
	$type = $info[2];
	$mime = $info['mime'];


	//get correct mime type and image function
	switch ($type) {
		case IMAGETYPE_JPEG:
			$image_create_func = 'imagecreatefromjpeg';
			$mime2 = 'image/jpeg';
		break;
		case IMAGETYPE_PNG:
			$image_create_func = 'imagecreatefrompng';
			$mime2 = 'image/png';
		break;
		case IMAGETYPE_GIF:
			$image_create_func = 'imagecreatefromgif';
			$mime2 = 'image/gif';
		break;
		case IMAGETYPE_BMP:
			$image_create_func = 'imagecreatefrombmp';
			$mime2 = 'image/bmp';
		break;
		case IMAGETYPE_WBMP:
			$image_create_func = 'imagecreatefromwbmp';
			$mime2 = 'image/wbmp';
		break;
		case IMAGETYPE_XBM:
			$image_create_func = 'imagecreatefromxbm';
			$mime2 = 'image/xbm';
		break;
		default:
			echo <<<END
				{
					"status" : "ERROR",
					"message" : "Not supported image file."
				}
END;
			die;
		break;
	}
	if (!isset($mime) || $mime=='') $mime = $mime2;


	//if there is a width and/or height specified (and smaller), then resize image
	if ((isset($_REQUEST['width']) && $_REQUEST['width']<$width) || (isset($_REQUEST['height']) && $_REQUEST['height']<$height)) {
		//resize on the sever

		$maxwidth = isset($_POST['width']) ? $_REQUEST['width'] : $width;
		$maxheight = isset($_POST['height']) ? $_REQUEST['height'] : $height;

		if ($width>$maxwidth) $nwidth=$maxwidth;
		if ($height>$maxheight) $nheight=$maxheight;
		if (isset($nwidth)) {
			$factor = (float)$nwidth/(float)$width;
			$nheight = round($factor*$height);
		} else if (isset($nheight)) {
			$factor = (float)$nheight/(float)$height;
			$nwidth = round($factor*$width);
		} else {
			$nwidth = $width;
			$nheight = $height;
		}

		$image_c = imagecreatetruecolor($nwidth,$nheight);
		$new_image = $image_create_func($fn);
		imagecopyresampled($image_c, $new_image, 0, 0, 0, 0, $nwidth, $nheight, $width, $height);
		ob_start();
		switch ($type) {
			case IMAGETYPE_PNG:
				if (ord(file_get_contents($fn,false,null,25,1)) & 4) {
					//png with transparency/alpha
					imagepng($image_c);
					$mime = 'image/png';
				} else {
					//png
					imagejpeg($image_c);
					$mime = 'image/jpeg';
				}
			break;
			case IMAGETYPE_JPEG:
			default:
				//jpeg/other?
				imagejpeg($image_c);
				$mime = 'image/jpeg';
			break;
		}
		$data = ob_get_contents();
		ob_end_clean();
		imagedestroy($new_image);
		imagedestroy($image_c);
		$width = $nwidth;
		$height = $nheight;
	} else {
		//just get the file with no resize
		$data = file_get_contents($fn);
	}
	//convert to base64
	$data = base64_encode($data);

	//From the PHP manual: "The file will be deleted from the temporary directory at the
	//end of the request if it has not been moved away or renamed."

	echo <<<END
		{
			"mime" : "$mime",
			"data" : "data:$mime;base64,$data",
			"width" : $width,
			"height" : $height,
			"status" : "OK",
			"message" : "OK"
		}
END;

