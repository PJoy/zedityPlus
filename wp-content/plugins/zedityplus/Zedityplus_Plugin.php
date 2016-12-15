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
		//echo 'hello<br>';
		?>
		<script>
			urls = [];
			ids = [];
		</script>
		<?php
		global $wpdb;

		$sql="SELECT id FROM wpz_posts WHERE post_type = 'post'";

		$posts = $wpdb->get_results($sql);

		$urls = [];
//echo 'yo';
		foreach ($posts as $post)
		{
			$id = $post->id;
			$tb = get_post_thumbnail_id($id);
			$url = wp_get_attachment_url($tb);
			$status = get_post_status($id);
			//echo $status.'<br>';
			if (strlen($url) > 1 && $status = 'published') {
				//echo '<pre>'.$url.'</pre>';
				array_push($urls,$url);
				?>
				<script>
					urls.push('<?php echo $url ?>');
					ids['<?php echo $url ?>'] = <?php echo $post->id; ?>
				</script>
<?php
			}
		}
?>
		<script>
			jQuery('img').each(function(e,a){
					console.log('img on page : ', a.src);
				urls.forEach(function(f){
					console.log('all img on posts : ', f);
					if (a.src == f){
						//console.log(f);
						//jQuery(a).wrap("<a rel='essai' class='fancybox' href='"+a.src+"'></a>");
						addArticleFancyBox(a, ids[f]);
					}
				});
			});

			function addArticleFancyBox(elem, id) {
				var ajaxurl = "<?php echo admin_url( 'admin-ajax.php' ); ?>";

				jQuery(document).ready(function () {
					jQuery(elem).on("click", function (e) {
						e.preventDefault(); // avoids calling preview.php
						jQuery.post(
							ajaxurl,
							{
								'action': 'add_foobar',
								'id': id
							},
							function (response) {
								var data = response.compiled;
								jQuery.fancybox(data, {
									'transitionIn'	:	'fade',
									'transitionOut'	:	'fade',
									'speedIn'		:	600,
									'speedOut'		:	200,
									'overlayShow'	:	false
								});
							})
					})
				});
				console.log('loaded post n°'+id+' in elem');
				console.log(elem);
			}

		</script>
<?php
	}


	public function adminPlus(){

		/*global $wpdb;
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

			if ( $title !== "Auto Draft" && $status = 'published') {
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
		}

*/
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
                            jQuery("iframe").contents().find("#zedity-txtImageLink").val(
                                jQuery("iframe").contents().find("#selectId option:selected").val()
                            );
                            jQuery("iframe").contents().find("#zedity-txtImageDescription").val('DEFAULT')
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


	public function addActionsAndFilters() {

		add_action( 'wp_ajax_add_foobar', 'prefix_ajax_add_foobar' );

		add_action('wp_footer',array(&$this, 'helloWorld'));
		add_action('admin_footer',array(&$this, 'adminPlus'));

        // Add options administration page
        // http://plugin.michael-simpson.com/?page_id=47
        add_action('admin_menu', array(&$this, 'addSettingsSubMenuPage'));

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
