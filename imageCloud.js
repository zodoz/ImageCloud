/**
 * Copyright (c) 2011 Mike Kent
 *
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the
 * "Software"), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so, subject to
 * the following conditions:
 *
 * The above copyright notice and this permission notice shall be included
 * in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
 * OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */
(function($) {
	$.fn.imageCloud = function(options) {
		// some default settings
		var settings = {
			width       : 300,            // pixel width of display box
			height      : 300,            // pixel height of display box
			rows        : 7,              // rows of images (at most)
			cols        : 7,              // cols of images (at most)
			spacing     : 5,              // pixel spacing between images
			maxSize     : 5,              // maximum block an image can take
			imgcls      : 'cloudImg',     // class to apply to image divs
			el          : this,           // this element
			fadeDuration: 1000,           // effect duration
			imageDelay  : 500,            // delay between add/remove image
			url         : '/imglist.json' // url of list of images
		};

		var images       = [];     // default images list, expecting:
		                           // [url] or [{url,weight}]
		var curBlocks    = [],     // current layouts of images
		    nextBlocks   = [],     // next layout of images
				displayField = [],     // 2d boolean array (cell occupied?)
				queue        = [];

		// override default settings
		if(options) {
			if(typeof options === "object") {
				$.extend(settings, options);
			} else if(typeof options === "string") {
				settings.url = options;
			}
		}

		// setup `this` container
		this.css({
			width : settings.width,
			height: settings.height
		});

		// setup block dimensions
		settings.blockWidth =
			Math.floor(
				settings.width -
				((settings.rows + 1) * settings.spacing)
			) / settings.rows;
		settings.blockHeight =
			Math.floor(
				settings.height -
				((settings.cols + 1) * settings.spacing)
			) / settings.cols;

		// get images list, then start everything
		$.get(
			settings.url,
			function(data, status) {
				images = data;
				run();
			},
			'json'
		);

		/**
		 * runs everything once image list is gotten.
		 * Inits display field, runs first add of all images,
		 * then cycles add/remove of images
		 */
		function run() {
			// init displayField
			for(var i=0;i<settings.rows;i++) {
				displayField[i] = [];
				for(var j=0;j<settings.cols;j++) {
					displayField[i][j] = 
						{
							// upper right coordinate
							ur:
								{
									x: (settings.blockWidth + settings.spacing) * j
											+ settings.spacing,
									y: (settings.blockHeight + settings.spacing) * i
											+ settings.spacing
								},
							// lower left coordinate
							ll:
								{
									x: (settings.blockWidth + settings.spacing) * j
											+ settings.spacing + settings.blockWidth,
									y: (settings.blockHeight + settings.spacing) * i
											+ settings.spacing + settings.blockHeight
								},
							occupied: false
						};
				}
			}
			// get first arragement
			curBlocks = genRandomBlocks();

			// iterations
			enqueue(0,nextIter);

			// perform iterations
			function nextIter() {
				nextBlocks = genRandomBlocks();

				// start add/remove process
				enqueue(0,addRemove);

				/**
				 * First remove an image if there are any to remove,
				 * then add an image if there is space and continue until
				 * all of nextBlocks have been used, then run nextIter() again.
				 */
				function addRemove() {
					// remove images if possible
					if(curBlocks.length > 0 && anyRemovableBlocks()) {
						enqueue(
							settings.imageDelay,
							function() {
								removeImage(curBlocks, displayField);
							}
						);
					}
					// add images if possible
					var nextBlock = getLargestAddableBlock(nextBlocks, displayField);
					if(nextBlock !== null) {
						enqueue(
							settings.imageDelay,
							function() {
								addImage(nextBlock, displayField);
							}
						);
					}
					// continue addRemove() or start another iteration
					if(anyAddableBlocks()) {
						enqueue(0,addRemove);
					} else {
						curBlocks = nextBlocks;
						enqueue(0,nextIter);
					}
					
					// search for removeable blocks
					function anyRemovableBlocks() {
						return testAny(
							curBlocks, function(block) {
								return block.visible;
							}
						);
					}

					// search for addable blocks
					function anyAddableBlocks() {
						return testAny(
							nextBlocks, function(block) {
								return !block.visible;
							}
						);
					}
				}
			}
		}

		/**
		 * adds an image if possible
		 *
		 * returns true if possible
		 *         false otherwise
		 */
		function addImage(block, displayField) {
			// return if we cannot find a valid block to add
			if(block === null) {
				return;
			}
			var coords = block.coords;
			block.visible = true;
			// make div accessable in block

			var urcell = coords[0],
					llcell = coords[1];
			urcell = displayField[urcell.r][urcell.c].ur;
			llcell = displayField[llcell.r][llcell.c].ll;
			var width = llcell.x - urcell.x,
					height = llcell.y - urcell.y;

			// create image element
			var img = $("<image>",
			  {
					src: chooseRandom(images)
				}
			);
			
			// get dimensions of the image
			var imgWidth = img.attr("width"),
					imgHeight = img.attr("height");
			
			// change the smaller value to fit unless the block size (width or 
			// height) is more than 1.6 times that of the other.
			if(imgWidth < imgHeight || width/height >= 1.6) {
				var y = 
				img.css(
					{
						width: width
					}
				);
			} else {
				img.css(
					{
						height: height
					}
				);
			}

			// make element accessable in block
			block.el = 
				$("<div>",
					{
						"class" : settings.imgcls
					}
				).css(
					{
						left    : urcell.x,
						top     : urcell.y,
						width   : llcell.x - urcell.x,
						height  : llcell.y - urcell.y,
						overflow: "hidden",
						display : "none"
					}
				)
					.append(img)
					.appendTo(settings.el)
					.fadeIn(settings.fadeDuration);

			// set display field as occupied
			for(var r = coords[0].r; r <= coords[1].r; r++) {
				for(var c = coords[0].c; c <= coords[1].c; c++) {
					displayField[r][c].occupied = true;
				}
			}
		}

		/**
		 * get the largest addable block
		 */
		function getLargestAddableBlock(blocks, displayField) {
			var maxArea = 0, maxIndex = -1, area, coords;
			for(var i=0;i<blocks.length;i++) {
				if(!blocks[i].visible && 
						isBlockAddable( blocks[i], displayField )
					)
				{
					coords = blocks[i].coords;
					area = (coords[1].r - coords[0].r + 1) *
						(coords[1].c - coords[0].c + 1);
					if(area > maxArea) {
						maxArea = area;
						maxIndex = i;
					}
				}
			}
			if(maxIndex >= 0)
				return blocks[maxIndex];
			return null;

			// check that the all cells the block would occupy are empty
			function isBlockAddable(block, displayField) {
				var coords = block.coords;
				for(var r = coords[0].r; r <= coords[1].r; r++) {
					for(var c = coords[0].c; c <= coords[1].c; c++) {
						if(displayField[r][c].occupied)
							return false;
					}
				}
				return true;
			}
		}

		/**
		 * get the first block that is addable
		 */
		function getFirstAddableBlock(blocks, displayField) {
			for(var i=0;i<blocks.length;i++) {
				if(!blocks[i].visible && 
						isBlockAddable( blocks[i], displayField )
					)
				{
					return blocks[i];
				}
			}
			return null;

			// check that the all cells the block would occupy are empty
			function isBlockAddable(block, displayField) {
				var coords = block.coords;
				for(var r = coords[0].r; r <= coords[1].r; r++) {
					for(var c = coords[0].c; c <= coords[1].c; c++) {
						if(displayField[r][c].occupied)
							return false;
					}
				}
				return true;
			}
		}

		/**
		 * removes an image
		 */
		function removeImage(blocks, displayField) {
			var block = getFirstRemovableBlock(blocks),
				coords = block.coords;

			// set block as not visible
			block.visible = false;

			// fade out coord and remove from DOM
			block.el.fadeOut(settings.fadeDuration, function() {
				$(this).remove();
			});

			// remove from displayField
			for(var r = coords[0].r; r <= coords[1].r; r++) {
				for(var c = coords[0].c; c <= coords[1].c; c++) {
					displayField[r][c].occupied = false;
				}
			}

			// returns the first block which is visible
			function getFirstRemovableBlock(blocks) {
				for(var i=0;i<blocks.length;i++) {
					if(blocks[i].visible) {
						return blocks[i];
					}
				}
			}
		}

		/**
		 * adds to the running queue
		 *
		 * uses running variable to determine if the queue needs to be
		 * started or is already running.
		 */
		var running = false;
		function enqueue(delay,fn) {
			queue.push({delay:delay,fn:fn});
			startQueue();

			// starts the queue if it is not already running
			function startQueue() {
				if(running)
					return;
				running = true;
				setTimeout(doNext,queue[0].delay);

				function doNext() {
					queue[0].fn();
					removeItem(queue,0);
					if(queue.length>0) {
						setTimeout(doNext,queue[0].delay);
					} else
						running = false;
				}
			}
		}

		/**
		 * generates a new sequence of blocks to place
		 * 
		 * returns blocks in the following form:
		 *   [
		 *     {
		 *       coords,
		 *       visible:false,
		 *     }
		 *   ]
		 */
		function genRandomBlocks() {
			var newDisplayField = [], blocks = [];
			for(var i=0;i<settings.rows;i++) {
				newDisplayField[i] = [];
				for(var j=0;j<settings.cols;j++) {
					newDisplayField[i][j] = false;
				}
			}

			var openPositions = getOpenPositions(newDisplayField);
			while(openPositions.length > 0) {
				// pick a random cell to start in
				var position = chooseRandom(openPositions);
				var coords = [
					$.extend({},position),     //clone position to new object
					$.extend({},position)
				];
				// directions to expand the block
				var directions = ['up','up','down','down','left','left,',
					'right','right'];
				// then expand it randomly
				var iters = randInt(3,8);    // random number of modifications
				for(;iters>0;iters--) {
					expand(
						coords,
						newDisplayField,
						chooseRandom(directions,true)
					);
				}
				// occupy the field based on the block
				for(var r = coords[0].r; r <= coords[1].r; r++) {
					for(var c = coords[0].c; c <= coords[1].c; c++) {
						newDisplayField[r][c] = true;
					}
				}
				// add the new block to the list of blocks
				blocks.push({coords:coords,visible:false});
				// refresh the list of open positions
				openPositions = getOpenPositions(newDisplayField);
			}

			return blocks;
			
			// get a list of open positions
			function getOpenPositions(displayField) {
				positions = [];
				for(var i=0;i<settings.rows;i++) {
					for(var j=0;j<settings.cols;j++) {
						if(!displayField[i][j])
							positions.push({r:i,c:j});
					}
				}
				return positions;
			}

			// only expands a block if it possible
			function expand(coords,displayField,direction) {
				if(
						canExpand(
							getExpansionCells(coords,direction),
							displayField)
					)
				{
					if(direction == 'up') {
						coords[0].r -= 1;
					} else if(direction == 'down') {
						coords[1].r += 1;
					} else if(direction == 'left') {
						coords[0].c -= 1;
					} else if(direction == 'right') {
						coords[1].c += 1;
					}
				}
			}
			// returns true if none of `cells` are occupied in `displayField`
			function canExpand(coords,displayField) {
				var coord;
				for(var i=0;i<coords.length;i++) {
					coord = coords[i];
					if(coord.r < 0 || coord.r >= settings.rows ||
							coord.c < 0 || coord.c >= settings.cols)
					{
						return false;   //cannot expand to there
					}
					if(displayField[coord.r][coord.c]) {
						return false;   // that coord is occupied
					}
				}
				return true;        // there are no coords occupied
			}
			// get the new cells that an expansion would include
			function getExpansionCells(coord,direction) {
				var rowStart, rowEnd, colStart, colEnd, cells = [];
				if(direction == 'up') {
					rowStart = rowEnd = coord[0].r - 1;
					colStart = coord[0].c;
					colEnd = coord[1].c;
				} else if(direction == 'down') {
					rowStart = rowEnd = coord[1].r + 1;
					colStart = coord[0].c;
					colEnd = coord[1].c;
				} else if(direction == 'left') {
					colStart = colEnd = coord[0].c - 1;
					rowStart = coord[0].r;
					rowEnd = coord[1].r;
				} else if(direction == 'right') {
					colStart = colEnd = coord[1].c + 1;
					rowStart = coord[0].r;
					rowEnd = coord[1].r;
				}
				for(;rowStart <= rowEnd;rowStart++) {
					for(var c = colStart;c <= colEnd;c++) {
						cells.push({r:rowStart,c:c});
					}
				}
				return cells;
			}
		}

		/**
		 * tests to see if any element in array is true via fn
		 */
		function testAny(arr, fn) {
			for(var i=0;i<arr.length;i++) {
				if(fn(arr[i])) {
					return true;
				}
			}
			return false;
		}

		/**
		 * implements reduce as specified in most map/reduce implementations
		 */
		function reduce(arr,fn) {
			var newArr = [];
			for(var i=0; i < arr.length; i++) {
				if(fn(arr[i])) {
					newArr.push(arr[i]);
				}
			}
			return newArr;
		}
		
		/**
		 * removes an item from an array.
		 * source: www.ejohn.org/blog/javascript-array-remove
		 */
		function removeItem(arr, from, to) {
			var rest = arr.slice((to || from) + 1 || arr.length);
			arr.length = from < 0 ? arr.length + from : from;
			return arr.push.apply(arr, rest);
		}

		/**
		 * choose a randome element from a list
		 */
		function chooseRandom(list,deleteItem) {
			var index = randInt(0,list.length-1),
				item = list[index];
			if(deleteItem === true)
				removeItem(list,index);
			return item;
		}

		/**
		 * get a random int in range
		 */
		function randInt(low,high) {
			return Math.floor(Math.random()*(high-low+1)+low);
		}
	};
})(jQuery);
