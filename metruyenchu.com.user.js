// ==UserScript==
// @name            MeTruyenChu downloader
// @name:vi         MeTruyenChu downloader
// @version      1.1.2
// @icon            https://static.cdnno.com/background/metruyenchu.jpg
// @description     Tải truyện từ MeTruyenChu định dạng EPUB.
// @description:vi  Tải truyện từ MeTruyenChu định dạng EPUB.
// @author       gianghd
// @match           https://metruyenchu.com/truyen/*
// @match           https://nuhiep.com/truyen/*
// @match           *://metruyencv.com/truyen/*
// @require         https://code.jquery.com/jquery-3.5.1.min.js
// @require         https://unpkg.com/jszip@3.1.5/dist/jszip.min.js
// @require         https://unpkg.com/file-saver@2.0.2/dist/FileSaver.min.js
// @require         https://unpkg.com/ejs@2.7.4/ejs.min.js
// @require         https://unpkg.com/jepub@2.1.4/dist/jepub.min.js
// @require         https://greasemonkey.github.io/gm4-polyfill/gm4-polyfill.js?v=a834d46
// @noframes
// @connect         self
// @run-at          document-idle
// @grant           GM_xmlhttpRequest
// @grant           GM.xmlHttpRequest
// ==/UserScript==
(function ($, window, document) {
    'use strict';
    /**
   * Nhận cảnh báo khi có chương bị lỗi
   */
    var errorAlert = true;
    /**
   * Xóa những đoạn ghi chú và quảng cáo ở cuối chương
   * Không cần ghi hết mà chỉ cần đoạn đầu, không phân biệt hoa thường, script sẽ xóa tất cả nội dung từ cụm muốn xóa trở về sau
   * Ngăn cách các đoạn bằng dấu |
   */
    var converter = 'Nếu muốn lọc những cụm ghi chú hoặc quảng cáo ở cuối chương truyện thì hãy ghi nó ở đây, lưu ý là những cụm bạn ghi vào đây có thể sẽ gây mất nội dung nếu nó xuất hiện ở đầu hoặc giữa chương truyện.';

    converter = new RegExp('(' + converter + ')', 'i');

    var pageName = document.title,
        $win = $(window),
		$li = $('<li>', {
			id: 'download',
			class:'mr-3'
		}),
        $download = $('<a>', {
            class: 'btn btn-outline-warning btn-md btn-block bg-yellow-white text-primary font-weight-semibold d-flex align-items-center justify-content-center',
            href: '#download',

            text: 'Tải xuống',
        }),
        downloadStatus = function (status) {
            $download.removeClass('btn-primary btn-success btn-info btn-warning btn-danger').addClass('btn-' + status);
        },
        $novelId = $('.active'),
        chapList = [],
        chapListSize = 0,
		$navTabChap = 0,
        chapId = '',
        chapTitle = '',
        count = 0,
        begin = '',
        end = '',
        endDownload = false,
        ebookTitle = '',
        ebookAuthor = '',
        ebookCover = '',
        ebookDesc = '',
        ebookType = [],
        beginEnd = '',
        titleError = [],
        host = location.host,
        pathname = location.pathname + '/',
        referrer = location.protocol + '//' + host + pathname,
        ebookFilename = pathname.slice(1, -1) + '.epub',
        credits =
        '<p>Truyện được tải từ <a href="' +
        referrer +
        '">metruyenchu</a></p><p>Userscript được viết bởi: <a href="https://lelinhtinh.github.io/jEpub/">Zzbaivong</a>, Được sửa bởi FixBug</p>',
        jepub;

    $("#js-read__content").removeClass("post-body");
    if (!$novelId.length) return;

    var $infoBlock = $('.media-body');
    var $imagesBlock = $('.media');

    ebookTitle = $infoBlock.find('h1').text().trim();
    ebookAuthor = $infoBlock.find('ul:first').find('li:first').text().trim();
    ebookCover = $imagesBlock.find('img').attr('src');
    ebookDesc = $('.content').html();

    var $ebookType = $infoBlock.find('ul:first').find('li');
    if ($ebookType.length) {
        var i = 1;
        $ebookType.each(function () {
            if (i > 2) {
                ebookType.push($(this).text().trim());
            }
            i++;
        });
    }
    jepub = new jEpub();
    jepub
        .init({
        title: ebookTitle,
        author: ebookAuthor,
        publisher: host,
        description: ebookDesc,
        tags: ebookType,
    })
        .uuid(referrer);
	$li.append($download);
    $li.insertAfter('#suggest-book');

    $download.one('click contextmenu', function (e) {
        e.preventDefault();

        var showChapList = $('.container a[href="#nav-chap"]');
        document.title = '[...] Vui lòng chờ trong giây lát';
		$download.html('Chờ một chút...');
		$navTabChap = $('#nav-tab-chap');
		chapListSize = Number($navTabChap.find('span:last').text().trim());
		if (chapListSize > 0) {
			var i;
			for (i = 1; i <= chapListSize; i++) {
				chapList.push('chuong-'+i);
			}

            if (e.type === 'contextmenu') {
                $download.off('click');
                var startFrom = prompt('Nhập ID chương truyện bắt đầu tải:', chapList[0]);
                startFrom = chapList.indexOf(startFrom);
                if (startFrom !== -1) chapList = chapList.slice(startFrom);
            } else {
                $download.off('contextmenu');
            }
            chapListSize = chapList.length;
			$win.on('beforeunload', function () {
				return 'Truyện đang được tải xuống...';
			});

			$download.one('click', function (e) {
				e.preventDefault();
				saveEbook();
			});

			getContent();
		}

    });

    function getContent() {
        if (endDownload) return;
        chapId = chapList[count];

        $.ajax({
            url: pathname + chapId + '/',
            xhrFields: {
                withCredentials: true,
            },
        }).done(function (response) {
            var $data = $(response),
                $chapter = $data.find('#js-read__content'),
                $notContent = $chapter.find('iframe, script, style, a, div, p:has(a[href*="truyencv.com"])'),
                $referrer = $chapter.find('[style]').filter(function () {
                    return this.style.fontSize === '1px' || this.style.fontSize === '0px' || this.style.color === 'white';
                }),
                chapContent;

            if (endDownload) return;

            chapTitle = $data.find('.nh-read__title').text().trim();
            if (chapTitle === '') chapTitle = 'Chương ' + chapId.match(/\d+/)[0];

            if (!$chapter.length) {
                chapContent = downloadError('Không có nội dung');
            } else {
                if ($chapter.find('#btnChapterVip').length) {
                    chapContent = downloadError('Chương VIP');
                } else if (
                    $chapter.filter(function () {
                        return this.textContent.toLowerCase().indexOf('vui lòng đăng nhập để đọc chương này') !== -1;
                    }).length
                ) {
                    chapContent = downloadError('Chương yêu cầu đăng nhập');
                } else {
                    var $img = $chapter.find('img');
                    if ($img.length) {
                        $img.replaceWith(function () {
                            return '<br /><a href="' + this.src + '">Click để xem ảnh</a><br />';
                        });
                    }

                    if ($notContent.length) $notContent.remove();
                    if ($referrer.length) $referrer.remove();

                    if ($chapter.text().trim() === '') {
                        chapContent = downloadError('Nội dung không có');
                    } else {
                        if (!$download.hasClass('btn-danger')) downloadStatus('warning');
                        chapContent = cleanHtml($chapter.html());
                    }
                }
            }

            jepub.add(chapTitle, chapContent);

            if (count === 0) begin = chapTitle;
            end = chapTitle;

            $download.html('Đang tải <strong>' + count + '/' + chapListSize + '</strong>');

            count++;
            document.title = '[' + count + '] ' + pageName;
            if (count >= chapListSize) {
                saveEbook();
            } else {
                getContent();
            }
        }).fail(function (err) {
            if(err && err.status == 404){
                log(`${pathname}${chapId}/ không tồn tại!, chuyển tới chương tiếp theo`, 2);
                count++;
                //lấy tiếp nội dung chương tiếp theo
                getContent();
            }
            else {
                setTimeout(function() {
                    window.open(pathname + chapId + '/');
                    getContent();
                }, 10000);
            }
        });
    }

    function saveEbook() {
        if (endDownload) return;
        endDownload = true;
        $download.html('Bắt đầu tạo EPUB');

        if (titleError.length) {
            titleError = '<p class="no-indent"><strong>Các chương lỗi: </strong>' + titleError.join(', ') + '</p>';
        } else {
            titleError = '';
        }
        beginEnd = '<p class="no-indent">Nội dung từ <strong>' + begin + '</strong> đến <strong>' + end + '</strong></p>';

        jepub.notes(beginEnd + titleError + '<br /><br />' + credits);

        GM.xmlHttpRequest({
            method: 'GET',
            url: ebookCover,
            responseType: 'arraybuffer',
            onload: function (response) {
                try {
                    jepub.cover(response.response);
                } catch (err) {
                    console.error(err);
                }
                genEbook();
            },
            onerror: function (err) {
                console.error(err);
                genEbook();
            },
        });
    }

    function genEbook() {
        jepub
            .generate('blob', function (metadata) {
            $download.html('Đang nén <strong>' + metadata.percent.toFixed(2) + '%</strong>');
        })
            .then(function (epubZipContent) {
            document.title = '[⇓] ' + ebookTitle;
            $win.off('beforeunload');

            $download
                .attr({
                href: window.URL.createObjectURL(epubZipContent),
                download: ebookFilename,
            })
                .text('Hoàn thành')
                .off('click');
            if (!$download.hasClass('btn-danger')) downloadStatus('success');

            saveAs(epubZipContent, ebookFilename);
        })
            .catch(function (err) {
            downloadStatus('danger');
            console.error(err);
        });
    }

	function cleanHtml(str) {
        str = str.replace(/\s*Chương\s*\d+\s?:[^<\n]/, '');
        str = str.replace(/[^\x09\x0A\x0D\x20-\uD7FF\uE000-\uFFFD\u10000-\u10FFFF]+/gm, ''); // eslint-disable-line
        str = str.replace(/\s[a-zA-Z0-9]{6,8}(="")?\s/gm, function (key, attr) {
            if (attr) return ' ';
            if (!isNaN(key)) return key;
            if (key.split(/[A-Z]/).length > 2) return ' ';
            if (key.split(/\d/).length > 1) return ' ';
            return key;
        });
        str = str.replace(/\([^(]+<button[^/]+<\/button>[^)]*\)\s*/gi, '');
        str = str.split(converter)[0];
        return '<div>' + str + '</div>';
    }
    function downloadError(mess, err) {
        downloadStatus('danger');
        if (err) console.error(mess);
        if (!chapTitle) return;

        titleError.push(chapTitle);
        if (errorAlert) errorAlert = confirm('Lỗi! ' + mess + '\nBạn có muốn tiếp tục nhận cảnh báo?');

        return '<p class="no-indent"><a href="' + referrer + chapId + '">' + mess + '</a></p>';
    }
    function log(message, type=1){
        var style='color:gray', prefix='INF';
        //1 - info, 2 - warm, 3 - error
        if(type == 2){
            style='color:orange';
            prefix='WAR';
        }
        else if(type==3){
            style='color:red';
            prefix='ERR';
        }
        console.log(`%c[MTTDownloader][${prefix}]${message}`, style);
    }

})(jQuery, window, document);
