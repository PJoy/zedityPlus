<?php


include_once('Zedityplus_LifeCycle.php');

class Zedityplus_Plugin extends Zedityplus_LifeCycle {

    /**
     * See: http://plugin.michael-simpson.com/?page_id=31
     * @return array of option meta data.
     */
    public function getOptionMetaData() {
        //  http://plugin.michael-simpson.com/?page_id=31
        return array(
            //'_version' => array('Installed Version'), // Leave this one commented-out. Uncomment to test upgrades.
            'ATextInput' => array(__('Enter in some text', 'my-awesome-plugin')),
            'AmAwesome' => array(__('I like this awesome plugin', 'my-awesome-plugin'), 'false', 'true'),
            'CanDoSomething' => array(__('Which user role can do something', 'my-awesome-plugin'),
                                        'Administrator', 'Editor', 'Author', 'Contributor', 'Subscriber', 'Anyone')
        );
    }

//    protected function getOptionValueI18nString($optionValue) {
//        $i18nValue = parent::getOptionValueI18nString($optionValue);
//        return $i18nValue;
//    }

    protected function initOptions() {
        $options = $this->getOptionMetaData();
        if (!empty($options)) {
            foreach ($options as $key => $arr) {
                if (is_array($arr) && count($arr > 1)) {
                    $this->addOption($key, $arr[1]);
                }
            }
        }
    }

    public function getPluginDisplayName() {
        return 'ZedityPlus';
    }

    protected function getMainPluginFileName() {
        return 'zedityplus.php';
    }

    /**
     * See: http://plugin.michael-simpson.com/?page_id=101
     * Called by install() to create any database tables if needed.
     * Best Practice:
     * (1) Prefix all table names with $wpdb->prefix
     * (2) make table names lower case only
     * @return void
     */
    protected function installDatabaseTables() {
        //        global $wpdb;
        //        $tableName = $this->prefixTableName('mytable');
        //        $wpdb->query("CREATE TABLE IF NOT EXISTS `$tableName` (
        //            `id` INTEGER NOT NULL");
    }

    /**
     * See: http://plugin.michael-simpson.com/?page_id=101
     * Drop plugin-created tables on uninstall.
     * @return void
     */
    protected function unInstallDatabaseTables() {
        //        global $wpdb;
        //        $tableName = $this->prefixTableName('mytable');
        //        $wpdb->query("DROP TABLE IF EXISTS `$tableName`");
    }


    /**
     * Perform actions when upgrading from version X to version Y
     * See: http://plugin.michael-simpson.com/?page_id=35
     * @return void
     */
    public function upgrade() {
    }



    public function helloWorld(){
	    ?>

        <script>
            var imgs = []
            <?php

            global $wpdb;

            $sql="SELECT id FROM wpz_posts WHERE post_type = 'post'";

            $posts = $wpdb->get_results($sql);

            foreach ($posts as $post)
            {
                $id = $post->id;
                $tb = get_post_thumbnail_id($id);
                $url = wp_get_attachment_url($tb);
                $status = get_post_status($id);
                if (strlen($url) > 1 && $status = 'published') {
                    ?>
            imgs['<?php echo $url ?>'] = <?php echo $id ?>;
            <?php
                }
            }

            ?>
                postid = imgs[jQuery('.zedity-box-Article .zedity-content img').attr('src')];

            jQuery('.zedity-box-Article .zedity-content img')
                .wrap('<a href="<?php echo admin_url( "admin-ajax.php" )."?action=add_foobar";?>" style="display: inline-block; width: 100%; height: 100%;" class="fancybox ajax" target="_top" data-target="_top" data-id="'+ postid +'">')

            window.setTimeout(function(){
                jQuery('.zedity-content a').attr('rel', 'gal');
            },100)
        </script>

        <style>
            /*#fancybox-title-over{
                display: none;
            }*/
            #fancybox-content{
                border-width: 0!important;
            }

            #fancybox-wrap{
                width: inherit!important;
            }

            #fancybox-right,
            #fancybox-left {
                height: 80%;
            }

        </style>

        <?php
	}


	public function adminPlus(){

		?>
		<script>
			function changeUI() {
				var checkExist = setInterval(function() {
					if (jQuery('iframe').contents().find('[id$=boxes] > div:nth-child(1) > div.zedity-ribbon-group-panel > div:nth-child(2)').length) {
						jQuery('iframe').contents().find('[id$=boxes] > div:nth-child(1) > div.zedity-ribbon-group-panel > div:nth-child(2)')
							.clone()
							.appendTo(
								jQuery('iframe').contents().find('[id$=boxes] > div:nth-child(1) > div.zedity-ribbon-group-panel')
							);

						jQuery('iframe').contents().find('[id$=boxes] > div:nth-child(1) > div.zedity-ribbon-group-panel > div:nth-child(4) > button > span.zedity-ribbon-button-label')
							.text('Article');
						jQuery('iframe').contents().find('[id$=boxes] > div:nth-child(1) > div.zedity-ribbon-group-panel > div:nth-child(4) > button > span.zicon.zicon-image.zicon-size-m')
							.removeClass('zicon-image')
							.addClass('zicon-text');

						jQuery('iframe').contents().find('[id$=boxes] > div:nth-child(1) > div.zedity-ribbon-group-panel > div:nth-child(4) > button')
							.click(function(){
								jQuery('iframe').contents().find('[id$=boxes] > div:nth-child(1) > div.zedity-ribbon-group-panel > div:nth-child(2) > button').click();
							});


						console.log("UI changed!");
						clearInterval(checkExist);

					}
				}, 100); // check every 100ms
			}

			function setJQ(){
                checkExists = setInterval(function() {
                    if (jQuery('iframe').contents().find("#catsId").length) {
                        jQuery("iframe").contents().find("#catsId").on("change", function(){
                            var cat = jQuery('iframe').contents().find("#catsId option:selected").text().replace(/ /g,"");
                            console.log(cat);
                            jQuery("iframe").contents().find("#selectId option").show();
                            jQuery("iframe").contents().find("#selectId option:not(."+cat+")").hide();
                        });
                        jQuery("iframe").contents().find("#selectId").on("change", function(){
                            jQuery("iframe").contents().find("#zedity-txtarticleLink").val(
                                jQuery("iframe").contents().find("#selectId option:selected").val()
                            );
                            jQuery("iframe").contents().find("#zedity-txtArticleDescription").val('DEFAULT')
                        });

                        console.log ('jquery ok');
                        clearInterval(checkExists);

                    }
                }, 100); // check every 100ms
            }

			//alert('yo');

		</script>

		<?php
	}

	public function overrideDefaultFancybox($i){
        wp_deregister_script('fancybox');
        wp_deregister_script('jquery.fancybox');
        wp_deregister_script('jquery_fancybox');
        wp_deregister_script('jquery-fancybox');

        wp_register_script('jquery-fancybox', '/wp-content/plugins/zedityplus/js/jquery.fancybox-1.3.8.js', array('jquery'));

    }

    function prefix_ajax_add_foobar() {

        // Handle request then generate response using WP_Ajax_Response
        $post = get_post($_POST['id']);
        $content = $post->post_content;
        $img = get_the_post_thumbnail($_POST['id'], array(500));


        $msg ='<script>console.log('.$_POST['id'].')
</script>
			<style>
			/* entire container, keeps perspective */
			#fancybox-wrap {
				perspective: 1000px;
			}
			/* flip the pane when hovered */
#fancybox-wrap.hover #fancybox-outer,
 #fancybox-wrap.flip #fancybox-outer,
 #fancybox-wrap.hover .flipper,
 #fancybox-wrap.flip .flipper {
	transform: rotateY(-180deg);
}

			.flip-container, .front, .back {
			    width: 460px;
				height: 460px;
			}

			/* flip speed goes here */
			#fancybox-outer {
				transition: 0.6s;
				/*transform-style: preserve-3d;*/

				position: relative;
			}

			 .flipper {
				/*transition: 0.6s;*/
				transition-delay: 0.2s;

				transform-style: preserve-3d;

				position: relative;
			}

			/* hide back of pane during swap */
			.front, .back {
				backface-visibility: hidden;
				    -webkit-backface-visibility: hidden; /* Chrome, Safari, Opera */

				/*overflow: hidden;*/
				position: absolute;
				top: 0;
				left: 0;
			}
			
			.hover .front{
			    /*display: none;*/
			}
			
			.hover .back {
			    /*overflow: visible;*/
			}

			/* front pane, placed above back */
			.front {
				z-index: 2;
				/* for firefox 31 */
				transform: rotateY(0deg);
			}

			/* back, initially hidden pane */
			.back {
			backface-visibility: visible;
			    -webkit-backface-visibility: visible; /* Chrome, Safari, Opera */

			    overflow-x: hidden; 

				/*transform: rotateY(180deg);*/
			}
			
			.hover .front #fancybox-switch {
			    display: none!important;
			}
			
			#fancybox-wrap:not(.hover) .back #fancybox-switch {
			    display: none!important;
			}
			
			.hover #fancybox-left,
			.hover #fancybox-right {
			    display: none!important;
			}

		</style>

		<div class="flip-container">
		    <div class="flipper">
		        <div class="back">
		        <a id="fancybox-switch" style="
    display: block;
    position: absolute;
    top: 0;
    right: 0;
    width: 35px;
    height: 35px;
    background: transparent url(http://www.bidbuysold.com.au/bidbuysold/images/pageflip.png);
    cursor: pointer;
    z-index: 111107;
"onclick="jQuery(\'#fancybox-wrap\').toggleClass(\'hover\')";></a>
		        '.$content.'</div>
		        <div class="front">
		        <a id="fancybox-switch" style="
    display: block;
    position: absolute;
    top: 0;
    right: 0;
    width: 35px;
    height: 35px;
    background: transparent url(http://www.bidbuysold.com.au/bidbuysold/images/pageflip.png);
    cursor: pointer;
    z-index: 111107;
"onclick="jQuery(\'#fancybox-wrap\').toggleClass(\'hover\')";></a>
		        '.$img.'</div>
	        </div>
	        <a id="fancybox-switch" style="display: inline;"></a>
        </div>';

        //$msg = '<div>'.$content.'</div><div>'.$img.'</div>';

        $return = array(
            'post' => $post,
            'content' => $content,
            'image'	=> $img,
            'compiled' => $msg
        );



        wp_send_json($return);
        // Don't forget to stop execution afterward.
        wp_die('ok');
        die();

    }


    public function addActionsAndFilters() {

		add_action( 'wp_ajax_add_foobar',array(&$this, 'prefix_ajax_add_foobar' ));
		add_action( 'wp_ajax_nopriv_add_foobar', array(&$this,'prefix_ajax_add_foobar' ));

		add_action('wp_footer',array(&$this, 'helloWorld'));
		add_action('admin_footer',array(&$this, 'adminPlus'));

        add_action('wp_footer', array(&$this, 'overrideDefaultFancybox'));


        // Add options administration page
        // http://plugin.michael-simpson.com/?page_id=47
        add_action('admin_menu', array(&$this, 'addSettingsSubMenuPage'));



        //NEW STUFF
        //add_action('wp_footer', $this->overrideDefaultFancybox('second'));



        // Example adding a script & style just for the options administration page
        // http://plugin.michael-simpson.com/?page_id=47
        //        if (strpos($_SERVER['REQUEST_URI'], $this->getSettingsSlug()) !== false) {
        //            wp_enqueue_script('my-script', plugins_url('/js/my-script.js', __FILE__));
        //            wp_enqueue_style('my-style', plugins_url('/css/my-style.css', __FILE__));
        //        }


        // Add Actions & Filters
        // http://plugin.michael-simpson.com/?page_id=37





        // Adding scripts & styles to all pages
        // Examples:
        //        wp_enqueue_script('jquery');
        //        wp_enqueue_style('my-style', plugins_url('/css/my-style.css', __FILE__));
        //        wp_enqueue_script('my-script', plugins_url('/js/my-script.js', __FILE__));


        // Register short codes
        // http://plugin.michael-simpson.com/?page_id=39


        // Register AJAX hooks
        // http://plugin.michael-simpson.com/?page_id=41

    }


}
