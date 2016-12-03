<?php
/**
 * The base configuration for WordPress
 *
 * The wp-config.php creation script uses this file during the
 * installation. You don't have to use the web site, you can
 * copy this file to "wp-config.php" and fill in the values.
 *
 * This file contains the following configurations:
 *
 * * MySQL settings
 * * Secret keys
 * * Database table prefix
 * * ABSPATH
 *
 * @link https://codex.wordpress.org/Editing_wp-config.php
 *
 * @package WordPress
 */

// ** MySQL settings - You can get this info from your web host ** //
/** The name of the database for WordPress */
define('DB_NAME', 'wordpress');

/** MySQL database username */
define('DB_USER', 'root');

/** MySQL database password */
define('DB_PASSWORD', 'root');

/** MySQL hostname */
define('DB_HOST', 'localhost');

/** Database Charset to use in creating database tables. */
define('DB_CHARSET', 'utf8mb4');

/** The Database Collate type. Don't change this if in doubt. */
define('DB_COLLATE', '');

/**#@+
 * Authentication Unique Keys and Salts.
 *
 * Change these to different unique phrases!
 * You can generate these using the {@link https://api.wordpress.org/secret-key/1.1/salt/ WordPress.org secret-key service}
 * You can change these at any point in time to invalidate all existing cookies. This will force all users to have to log in again.
 *
 * @since 2.6.0
 */
define('AUTH_KEY',         '~q_xCz1^vDgpe@(NHSn&Qq]X^;_of0U:Qe~lBmIFvd`w`jn_=Vgaqki1b6D2&O|D');
define('SECURE_AUTH_KEY',  '!*mi*qQ/x)El?2u?MZbQFB|S0z%DDEK:KH.c>v}e:lIsaA4@QrU>bq+Td;]bu~9^');
define('LOGGED_IN_KEY',    ' 2n:58x~V=Pr*1]e]vkE);^>=|[Gn&H9:?}*0cU,_YHSV]; &!}T :A:g4(C0dRe');
define('NONCE_KEY',        'Vc$ml1BM(y mC+%Vw7<eA4X1;IixxAj94u_@M%g {9ocD?1@Hp_FL{3$-*{QyzJ9');
define('AUTH_SALT',        '[y]g6Mxk|RD&V58)fT#BKA^0[; Ub:yXv->Vw(N#_ru6NIUIDf^Um[2k]d?Mo#l7');
define('SECURE_AUTH_SALT', 'VuNn>75)EL]o81@A}}3-&h&sM&Jzq@uilp3Kt@g%=ONU ~]F3_zw|x&GO{fi/f~ ');
define('LOGGED_IN_SALT',   'L2fAX &5eEa3-**.vO$]~-5O1?Dn(0Y=t`~g3/0$j.Gi<:uH%{j<x}+j:VW=u*:K');
define('NONCE_SALT',       'gJ2_5Q2dmpD-n%BZ$`wdL&krM3^ChxH#2,>^64[%ad~@~,T~jO0Y0Jlmhr=syOy@');

/**#@-*/

/**
 * WordPress Database Table prefix.
 *
 * You can have multiple installations in one database if you give each
 * a unique prefix. Only numbers, letters, and underscores please!
 */
$table_prefix  = 'wpz_';

/**
 * For developers: WordPress debugging mode.
 *
 * Change this to true to enable the display of notices during development.
 * It is strongly recommended that plugin and theme developers use WP_DEBUG
 * in their development environments.
 *
 * For information on other constants that can be used for debugging,
 * visit the Codex.
 *
 * @link https://codex.wordpress.org/Debugging_in_WordPress
 */
define('WP_DEBUG', true);

/* That's all, stop editing! Happy blogging. */

/** Absolute path to the WordPress directory. */
if ( !defined('ABSPATH') )
	define('ABSPATH', dirname(__FILE__) . '/');

/** Sets up WordPress vars and included files. */
require_once(ABSPATH . 'wp-settings.php');
