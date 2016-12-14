<?php
header('Content-type: text/css');
@session_start();
if (isset($_SESSION['zedity_webfonts'])) {
	foreach ($_SESSION['zedity_webfonts'] as $font) {
		$fontname = explode(',',$font);
		$fontname = urlencode($fontname[0]);
		echo "@import url(\"//fonts.googleapis.com/css?family=$fontname\");\n";
	}
}
if (isset($_SESSION['zedity_customfontscss'])) {
	echo $_SESSION['zedity_customfontscss'];
}
