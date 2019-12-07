/*Copyright (c) 2013-2016, Rob Schmuecker
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

* Redistributions of source code must retain the above copyright notice, this
  list of conditions and the following disclaimer.

* Redistributions in binary form must reproduce the above copyright notice,
  this list of conditions and the following disclaimer in the documentation
  and/or other materials provided with the distribution.

* The name Rob Schmuecker may not be used to endorse or promote products
  derived from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL MICHAEL BOSTOCK BE LIABLE FOR ANY DIRECT,
INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING,
BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY
OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE,
EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.*/

/*  TreeScheduler.js
    Haley Psomas-Sheridan, Jeff Olson, Mathew Schaffer
    CS-470, Fall 2019

    Scheduler Application:
    TreeScheduler takes a json file as input, and creates a hierarchical tree structure
    based on the class information in the json. This program is intended to be used with
    CS_Courses_2197_Schd_Dept_Stu_Views.json; unpredictable results will occur if
    used with json files that are not formatted as intended.

    TreeScheduler provides adding, deleting and updating functionality for the tree.
    Nodes (classes) of the tree may be dragged and dropped into the boxes in the top menu,
    each box in the top menu provides a list of all dragged and dropped nodes on hoverOver.
    Updated Nodes will change color to red, as will all parental nodes in the path to the
    root node, to denote that a change was made to any given branch of the tree.

    Nodes are expandable and collapsible, an option that is displayed in the context menu
    when any node is right-clicked.
 */



//draws the tree scheduler view
function drawTree() {

    var universalRoot;
    var fullObj;


     //counts the number of nodes added to tree, for creation of id
    var TreeView = true; //bool to determine how to switch back and forth

    //lists for nodes that are dragged to various top menu options
    var draglist0 = "Added to this schedule:";
    var draglist1= "Added to this schedule:";
    var draglist2= "Added to this schedule:";
    var draglist3= "Added to this schedule:";
    var draglist4= "Added to this schedule:";


    //variables for adding, deleting and updating the nodes
    var create_node_active = false;
    var rename_active = false;
    var create_node_parent = null;
    var rename_node_parent = null;
    var node_to_rename = null;
    var base_root_num;
    var update_count = 0;

    d3.select("svg").remove();

// Get JSON data
    treeJSON = d3.json("CS_Courses_2197_Schd_Dept_Stu_Views.json", function (error, treeData) {


        // Calculate total nodes, max label length
        var totalNodes = 0;
        var maxLabelLength = 0;
        // variables for drag/drop
        var selectedNode = null;
        var draggingNode = null;
        // panning variables
        var panSpeed = 200;
        var panBoundary = 20; // Within 20px from edges will pan when dragging.
        // Misc. variables
        var i = 0;
        var duration = 750;
        var root;

        var dataContainer = [];
        var headers = [];


        // preprocessing data to make it into format flare needs. i.e:  name, children, parent attributes
        //formatted the as a hierarchical series of objects
        fullObj = {
            name: "CS",
            children: [],
            is_updated : false
        };

        headers = [];
        fullObj.name = 'schedulerView';

        Object.keys(treeData['schedulerView']).forEach((value) => {
            headers.push(value);
        });

        headers.forEach((value) => {
            var objtmp = {
                name: "",
                children: null,
                is_updated : false
            };

            objtmp.name = value;

            var dataTemp = [];

            Object.keys(treeData['schedulerView'][`${value}`]).forEach((keys) => {
                var dataTemp2 = [];
                var objNu = {
                    name: "",
                    children: null,
                    is_updated : false
                };
                if (keys != "isMultiComponent") {
                    objNu.name = keys;
                    treeData['schedulerView'][`${value}`][`${keys}`].forEach((obj) => {
                        dataTemp2.push(obj);
                    })
                    //dataTemp2.sort();
                    objNu.children = dataTemp2;
                    dataTemp.push(objNu);
                }

            });
            objtmp.children = dataTemp;
            dataContainer.push(objtmp);
        });
        dataContainer.sort(function(a,b) {
            var aName = a.name.substring(3,6);
            var bName = b.name.substring(3,6);
            //console.log(aName, " : ", bName);
            if(aName < bName) {
                return -1;
            }
            else if (aName > bName) {
                return 1;
            }
            else {
                return 0;
            }
        });

        fullObj.children = dataContainer;
        var length = Object.keys(treeData).length;

        fullObj.children.forEach((value) => {
            if(value.children != null){
                value.children.forEach((obj) => {
                    if(obj.children != null){
                        obj.children.forEach((d) => {
                            d.name = d.course_title;
                            if (d.components.length === 1) {
                                let actName1 = d.components[0];
                                d.children = Array(d[`${actName1}`]);
                            }
                            else if (d.components.length === 2) {
                                let actName1 = d.components[0];
                                let actName2 = d.components[1];
                                d.children = Array(d[`${actName1}`]);
                                d.children.push(d[`${actName2}`]);
                            }
                        });
                    }
                });
            }
        });
        // done pre-processing, fullObj is the reconfigured json object to use


        // size of the diagram
        var viewerWidth = $(document).width();
        var viewerHeight = $(document).height();

        var tree = d3.layout.tree()
            .size([viewerHeight, viewerWidth]);

        // define a d3 diagonal projection for use by the node paths later on.
        var diagonal = d3.svg.diagonal()
            .projection(function (d, i) {
                //console.log(d);
                return [d.y, d.x];
            });


        // A recursive helper function for performing some setup by walking through all nodes
        function visit(parent, visitFn, childrenFn) {
            if (!parent) return;

            visitFn(parent);

            var children = childrenFn(parent);
            if (children) {
                var count = children.length;
                for (var i = 0; i < count; i++) {
                    visit(children[i], visitFn, childrenFn);
                }
            }
        }

        // Call visit function to establish maxLabelLength
        visit(fullObj, function(d) {
            totalNodes++;
            // once again, just incase name attr isnt present
            if (d.name) {
                maxLabelLength = Math.max(d.name.length, maxLabelLength);
            }
            else if (d.course_title) {
                maxLabelLength = Math.max(d.course_title.length, maxLabelLength);
            }

            else if (d.instructors) {
                let fullName = d.instructors[0].instructor_fName + " " + d.instructors[0].instructor_lName;
                maxLabelLength = Math.max(fullName.length, maxLabelLength);
            }


        }, function(d) {
            return d.children && d.children.length > 0 ? d.children : null;
        });


        // sort the tree according to the node names
        function sortTree() {
            tree.sort(function (a, b) {
                return b.name.toLowerCase() < a.name.toLowerCase() ? 1 : -1;
            });
        }


        // Sort the tree initially in case the JSON isn't in a sorted order.
        //sortTree();


        function pan(domNode, direction) {
            var speed = panSpeed;
            if (panTimer) {
                clearTimeout(panTimer);
                translateCoords = d3.transform(svgGroup.attr("transform"));
                if (direction == 'left' || direction == 'right') {
                    translateX = direction == 'left' ? translateCoords.translate[0] + speed : translateCoords.translate[0] - speed;
                    translateY = translateCoords.translate[1];
                } else if (direction == 'up' || direction == 'down') {
                    translateX = translateCoords.translate[0];
                    translateY = direction == 'up' ? translateCoords.translate[1] + speed : translateCoords.translate[1] - speed;
                }
                scaleX = translateCoords.scale[0];
                scaleY = translateCoords.scale[1];
                scale = zoomListener.scale();
                svgGroup.transition().attr("transform", "translate(" + translateX + "," + translateY + ")scale(" + scale + ")");
                d3.select(domNode).select('g.node').attr("transform", "translate(" + translateX + "," + translateY + ")");
                zoomListener.scale(zoomListener.scale());
                zoomListener.translate([translateX, translateY]);
                panTimer = setTimeout(function () {
                    pan(domNode, speed, direction);
                }, 50);
            }
        }

        // Define the zoom function for the zoomable tree
        function zoom() {
            svgGroup.attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
        }


        // define the zoomListener which calls the zoom function on the "zoom" event constrained within the scaleExtents
        var zoomListener = d3.behavior.zoom().scaleExtent([0.1, 3]).on("zoom", zoom);



        // define the baseSvg, attaching a class for styling and the zoomListener
        var baseSvg = d3.select("#tree-container").append("svg")
            .attr("width", viewerWidth)
            .attr("height", viewerHeight)
            .attr("class", "overlay")
            .call(zoomListener);


        var lastDragged;
        // Define the drag listeners for drag/drop behaviour of nodes.
        dragListener = d3.behavior.drag()
            .on("dragstart", function (d) {
                if (d == root) {
                    return;
                }
                dragStarted = true;
                nodes = tree.nodes(d);
                d3.event.sourceEvent.stopPropagation();
                // it's important that we suppress the mouseover event on the node being dragged. Otherwise it will absorb the mouseover event and the underlying node will not detect it d3.select(this).attr('pointer-events', 'none');
            })
            .on("drag", function (d) {
                if (d == root) {
                    return;
                }
                if (dragStarted) {
                    domNode = this;
                    lastDragged = d;

                    draggingNode = d;
                    dragStarted = null;
                }


                // get coords of mouseEvent relative to svg container to allow for panning
                relCoords = d3.mouse($('svg').get(0));
                if (relCoords[0] < panBoundary) {
                    panTimer = true;
                    pan(this, 'left');
                } else if (relCoords[0] > ($('svg').width() - panBoundary)) {

                    panTimer = true;
                    pan(this, 'right');
                } else if (relCoords[1] < panBoundary) {
                    panTimer = true;
                    pan(this, 'up');
                } else if (relCoords[1] > ($('svg').height() - panBoundary)) {
                    panTimer = true;
                    pan(this, 'down');
                } else {
                    try {
                        clearTimeout(panTimer);
                    } catch (e) {

                    }
                }

                // this shows the node being dragged
                    var x = d3.event.x;
                    var y = d3.event.y;
                    d3.select(this).attr("transform", "translate(" + x + "," + y + ")");


            }).on("dragend", function (d) {
                if (d == root) {
                    return;
                }
                domNode = this;

                endDrag(d);
            });



        function endDrag(d) {

            selectedNode = null;

            d3.select(domNode).attr('class', 'node');

            if (draggingNode !== null) {
                update(root);
                centerNode(draggingNode);
                draggingNode = null;
            }
        }

        // Helper functions for collapsing and expanding nodes.
        function collapse(d) {
            if (d.children) {
                d._children = d.children;
                d._children.forEach(collapse);
                d.children = null;
            }
        }

        function expand(d) {
            if (d._children) {
                d.children = d._children;
                d.children.forEach(expand);
                d._children = null;
            }
        }


        // Function to center node when clicked/dropped so node doesn't get lost when collapsing/moving with large amount of children.
        function centerNode(source) {
            scale = zoomListener.scale();
            x = -source.y0;
            y = -source.x0;
            x = x * scale + viewerWidth / 2;
            y = y * scale + viewerHeight / 2;
            d3.select('g').transition()
                .duration(duration)
                .attr("transform", "translate(" + x + "," + y + ")scale(" + scale + ")");
            zoomListener.scale(scale);
            zoomListener.translate([x, y]);
        }


        // Toggle children function - represent children of expanded node as children, and compressed children as _children
        function toggleChildren(d) {
            if (d.children) {
                d._children = d.children;
                d.children = null;
            } else if (d._children) {
                d.children = d._children;
                d._children = null;
            }
            return d;
        }

        // Toggle children on click. (expand/collapse node on click)
        function click(d) {
            if (d3.event.defaultPrevented) return; // click suppressed
            d = toggleChildren(d);
            update(d);
            centerNode(d);
        }

        function update(source) {
            // Compute the new height, function counts total children of root node and sets tree height accordingly.
            // This prevents the layout looking squashed when new nodes are made visible or looking sparse when nodes are removed
            // This makes the layout more consistent.
            var levelWidth = [1];
            var childCount = function (level, n) {

                if (n.children && n.children.length > 0) {
                    if (levelWidth.length <= level + 1) levelWidth.push(0);

                    levelWidth[level + 1] += n.children.length;
                    n.children.forEach(function (d) {
                        childCount(level + 1, d);
                    });
                }
            };
            childCount(0, root);


            var newHeight = d3.max(levelWidth) * 25; // 25 pixels per line
            tree = tree.size([newHeight, viewerWidth]);


            // Compute the new tree layout.
            var nodes = tree.nodes(root).reverse(),
                links = tree.links(nodes);



            // Set widths between levels based on maxLabelLength.
            nodes.forEach(function (d) {
                //console.log(d.depth);
                d.y = (d.depth * (maxLabelLength * 10)); //maxLabelLength * 10px
                // alternatively to keep a fixed scale one can set a fixed depth per level
                // Normalize for fixed-depth by commenting out below line
                // d.y = (d.depth * 500); //500px per level.
            });

            // Update the nodesâ€¦
            node = svgGroup.selectAll("g.node")
                .data(nodes, function (d) {
                    return d.id || (d.id = ++i);
                });


            // Enter any new nodes at the parent's previous position.
            var nodeEnter = node.enter().append("g")
                .call(dragListener)
                .attr("class", "node")
                .attr("transform", function (d) {
                    return "translate(" + source.y0 + "," + source.x0 + ")";
                })
                .on('click', click);



            nodeEnter.append("circle")
                .attr('class', 'nodeCircle')
                .attr("r", 0);


            nodeEnter.append("text")
                .attr("x", function(d) {
                    return d.children || d._children ? -10 : 10;
                })
                .attr("dy", ".35em")
                .attr('class', 'nodeText')
                .attr("text-anchor", function(d) {
                    return d.children || d._children ? "end" : "start";
                })
                .text(function(d) {
                    if (d.name) {
                        return d.name;
                    }
                    else if (d.course_title) {
                        return d.course_title
                    }

                    else if (d.instructors) {
                        //console.log(d.instructors[0].instructor_lName);
                        let fullName = d.instructors[0].instructor_fName + " " + d.instructors[0].instructor_lName;
                        return fullName;
                    }

                })
                .style("fill-opacity", 0);


            // Update the text to reflect whether node has children or not.
            node.select('text')
                .attr("x", function(d) {
                    return d.children || d._children ? -10 : 10;
                })
                .attr("text-anchor", function(d) {
                    return d.children || d._children ? "end" : "start";
                })
                .text(function(d) {
                    //d should have a name, but if it doesn't..
                    if (d.name) {
                        return d.name;
                    }
                    else if (d.course_title) { //check for course_title
                        return d.course_title
                    }
                    else if (d.instructors) { //check for instructors
                        let fullName = d.instructors[0].instructor_fName + " " + d.instructors[0].instructor_lName + ": " + d.class_number + " : " + d.component;
                        return fullName;
                    }

                });

            // Change the circle fill depending on whether it has children and is collapsed (and whether it or one of its children has been updated)
            node.select("circle.nodeCircle")
                .attr("r", 4.5)
                .attr('stroke', function (d) {
                    if(d.is_updated == true){//updated nodes
                        return '#DC143C';
                    }
                    return 'steelblue';
                })
                .style("fill", function (d) {
                            if(d.is_updated == true){
                                return d._children ?  '#CD5C5C': "orange"; //updated nodes
                            }
                        return d._children ? "lightsteelblue" : "#fff";
                });

            node.on("mouseover", function (node) {
                // add popup when node is a termainal node
                if (node._children === undefined && node.children === undefined) {
                    var TerminalMenu = OnMouseOver(baseSvg).items('1', '2', '3', '4', '5', '6');
                    d3.event.preventDefault();
                    //setTimeout(TerminalMenu, 2000, d3.event.pageX, d3.event.pageY, node);
                    TerminalMenu(d3.event.pageX, d3.event.pageY, node);
                }
            })
                .on("mouseout", function (node) {
                    //remove popup menu
                    d3.select('.onhover-menu').remove();
                    d3.select('.menu-ent').select('svg').remove();

                });

            node.on("contextmenu", function (d, i) {
                console.log(d.depth);
                let level = d.parent ? d.parent.depth + 1 : 0;
                if (level === 0) {
                    var menu = contextMenu(baseSvg).items('Major: ', 'Add class', 'Expand All', 'Collapse All');
                    d3.event.preventDefault();
                    menu(d3.event.pageX, d3.event.pageY, d);
                }
                else if (level === 1) {
                    var menu = contextMenu(baseSvg).items('Base class: ', 'Add combined class', 'Delete node', 'Rename', 'Expand All','Collapse All', );
                    d3.event.preventDefault();
                    menu(d3.event.pageX, d3.event.pageY, d);
                }
                else if (level === 2) {
                    var menu = contextMenu(baseSvg).items('Combined class: ', 'Add section', 'Delete node', 'Rename', 'Expand All', 'Collapse All');
                    d3.event.preventDefault();
                    menu(d3.event.pageX, d3.event.pageY, d);
                }
                else if (level === 3) {
                    var menu = contextMenu(baseSvg).items('Section: ',  'Add terminal node', 'Delete node', 'Rename', 'Expand All', 'Collapse All');
                    d3.event.preventDefault();
                    menu(d3.event.pageX, d3.event.pageY, d);
                }
                else if (level === 4) {
                    var menu = contextMenu(baseSvg).items('More Info: ', 'Delete node', 'Rename');
                    d3.event.preventDefault();
                    menu(d3.event.pageX, d3.event.pageY, d);
                }
            });



            // Transition nodes to their new position.
            var nodeUpdate = node.transition()
                .duration(duration)
                .attr("transform", function (d) {
                    //console.log('nodeUpdate just happened ')
                    return "translate(" + d.y + "," + d.x + ")";

                });

            // Fade the text in
            nodeUpdate.select("text")
                .style("fill-opacity", 1);

            // Transition exiting nodes to the parent's new position.
            var nodeExit = node.exit().transition()
                .duration(duration)
                .attr("transform", function (d) {
                    return "translate(" + source.y + "," + source.x + ")";
                })
                .remove();

            nodeExit.select("circle")
                .attr("r", 0);

            nodeExit.select("text")
                .style("fill-opacity", 0);

            // Update the linksâ€¦

            var link = svgGroup.selectAll("path.link")
                .data(links, function (d) {
                    return d.target.id;
                });


            // Enter any new links at the parent's previous position.
            link.enter().insert("path", "g")
                .attr("class", "link")
                .attr("d", function (d) {

                    var o = {
                        x: source.x0,
                        y: source.y0
                    };
                    return diagonal({
                        source: o,
                        target: o
                    });

                });


            // Transition links to their new position.
            link.transition()
                .duration(duration)
                .attr("d", diagonal);

            // Transition exiting nodes to the parent's new position.
            link.exit().transition()
                .duration(duration)
                .attr("d", function (d) {
                    var o = {
                        x: source.x,
                        y: source.y
                    };
                    return diagonal({
                        source: o,
                        target: o
                    });
                })
                .remove();

            // Stash the old positions for transition.
            nodes.forEach(function (d) {
                d.x0 = d.x;
                d.y0 = d.y;
            });
        }


        // Append a group which holds all nodes and which the zoom Listener can act upon.
        var svgGroup = baseSvg.append("g");


        // Define the root
        root = fullObj;
        root.x0 = viewerHeight / 2;
        root.y0 = 0;

        // Layout the tree initially and center on the root node.
        update(root);
        centerNode(root);



        root.children.forEach((value) => {
            //console.log(value);
            if(value.children != null){

                //collapse;
                collapse(value);
                update(value);

            }
        });


        centerNode(root);


        universalRoot = root;
        var justDragged;

        let boxMenu = baseSvg.append("svg")
            .attr('class', 'boxes-svg')
            .attr("width", viewerWidth)
            .attr("height", 300)
            .on('click', function(){
                lastDragged = null;
            })
            .on("mouseup", function(d){
                justDragged = lastDragged;
                console.log("lastDragged", lastDragged);

                if(lastDragged) { //display the names of the classes added to each add box on the top menu

                    if (d3.event.pageX < 270) {
                        draglist0 = draglist0 + "<br/>" + lastDragged.name;
                        message = draglist0;

                    } else if (d3.event.pageX < 535) {

                        draglist1 = draglist1 + "<br/>" + lastDragged.name;
                        message = draglist1;
                    } else if (d3.event.pageX < 800) {

                        draglist2 = draglist2 + "<br/>" + lastDragged.name;
                        message = draglist2;

                    } else if (d3.event.pageX < 1050) {

                        draglist3 = draglist3 + "<br/>" + lastDragged.name;
                        message = draglist3;

                    } else if (d3.event.pageX > 1050) {

                        draglist4 = draglist4 + "<br/>" + lastDragged.name ;
                        message = draglist4;
                    }
                    console.log('lastDragged', lastDragged);

                }

                lastDragged = null;

                console.log( d3.event.pageX, d3.event.pageY )

            });



        /******* draw top menu ********/

        //leave this option for a more complex top menu
        var rows = 1;
        var columns = 4;

        const top = d3.range(rows).map(d => []).map((row, i) => {
            return d3.range(columns).map((col, j) => ({
                row: i,
                column: j,

            }));
        });

        const topBox = boxMenu //for top menu
            .selectAll('.topBox')
            .data(top)
            .enter()
            .append('g')
            .attr('class', 'topBox')
            .attr('transform', (d, i) => `translate(${100 * i},0 )`);

        topBox.append('rect')
            .attr("width", viewerWidth)
            .attr("height", 160)
            .style("fill", "steelblue");

        const allSquares = topBox.selectAll('.box-cell') //for top menu
            .data(d => d)
            .enter()
            .append('g')
            .attr('class', d => `box-cell-g-${d.column}`)
            .attr('transform', (d, i) => `translate(${(260 )* i + 10 },10 )`);


        allSquares.append('rect') //for top menu
            .attr("width", 250)
            .attr("height", 135)
            .style("fill", "grey")
            .attr('stroke', "darkgrey")
            .attr('stroke-dasharray', '10,5')
            .attr('stroke-linecap', 'butt')
            .attr('stroke-width', '3')
            .attr("r", 100)
            .style('fill', 'lightgrey');


        var circle = allSquares.append("circle") //for top menu
            .attr("cx", 125)
            .attr("cy", 65)
            .attr("r", 40)
            .style('fill', 'white')
            .attr('stroke', 'darkgrey')
            .attr('stroke', "darkgrey")
            .attr('stroke-dasharray', '10,5')
            .attr('stroke-linecap', 'butt')
            .attr('stroke-width', '3');


        allSquares.append('text') //for top menu
            .attr("y", 90)
            .attr("x", 97)
            .attr('fill','grey')
            .style("font", "100px times")
            .text('+');


        //prints the icon to switch between projects at the top right hand side
        var mini_tree  = d3.select('.topBox').append("svg:image")
            .attr('x', 0)
            .attr('y', 0)
            .attr('width', 250)
            .attr('height', 135)
            //.attr("xlink:href", "https://www.meccanismocomplesso.org/wp-content/uploads/2013/12/dendrogram_es01.jpg")
            //.attr('xlink:href', 'http://4.bp.blogspot.com/-gRcgPHK-sxw/UtIDyQlILqI/AAAAAAAAAjE/bznMVA_8P0k/s1600/tree-10.png')
            .attr('xlink:href',function(){
                if(TreeView){// if user viewing the Tree, display the option to switch to the weekly schedule
                    return 'https://www.jqueryscript.net/images/Dynamic-Weekly-Scheduler-jQuery-Schedule.jpg';
                }//else display the option to go to the tree view
                return 'http://4.bp.blogspot.com/-gRcgPHK-sxw/UtIDyQlILqI/AAAAAAAAAjE/bznMVA_8P0k/s1600/tree-10.png';
            })
            .attr('transform', (d, i) => `translate(${(300 )* 4 + 10 },10 )`);

        mini_tree.on('click',function(){
            if(TreeView == true){
                console.log('SWITCH TO WEEKLY VIEW');
                d3.select("svg").remove();
            }
            else{
                console.log('SWITCH TO TREE VIEW');
            }

        });


        var div = d3.select("body").append("div")
            .attr("class", "tooltip")
            .style("opacity", 0);


        allSquares //top menu
            .on("mouseup", function(d) {
                justDragged = lastDragged;


                if (lastDragged) {//add dragged values to the list

                    if (d3.event.pageX < 270) {
                        draglist0 = draglist0 + "<br/>" + lastDragged.name;

                    } else if (d3.event.pageX < 535) {
                        draglist1 = draglist1 + "<br/>" + lastDragged.name;

                    } else if (d3.event.pageX < 800) {
                        draglist2 = draglist2 + "<br/>" + lastDragged.name;

                    } else if (d3.event.pageX < 1050) {
                        draglist3 = draglist3 + "<br/>" + lastDragged.name;

                    } else if (d3.event.pageX > 1050) {
                        draglist4 = draglist4 + "<br/>" + lastDragged.name;
                    }
                }

                lastDragged = null;
            })
            .on("mouseover", function (d, i) { //mouseOver top menu

                d3.select(this).transition() //changes color of square
                    .duration('50')
                    .attr('opacity', '.85');


                if (d3.event.pageX < 270) {//print message based on which square mouse is over
                    message = draglist0;
                } else if (d3.event.pageX < 535) {
                    message = draglist1;
                } else if (d3.event.pageX < 800) {
                    message = draglist2;
                } else if (d3.event.pageX < 1050) {
                    message = draglist3;
                } else if (d3.event.pageX > 1050) {
                    message = draglist4;
                }


                //displays the message over the square
                div.transition()
                    .duration(200)
                    .style("opacity", .9);
                div	.html(message)
                    .style("left", (d3.event.pageX) + "px")
                    .style("top", (d3.event.pageY - 28) + "px");

            })
            .on('mouseout', function (d, i) {
                d3.select(this).transition()
                    .duration('50')
                    .attr('opacity', '1');
                div.transition()
                    .duration('50')
                    .style("opacity", 0);
            });


        function OnMouseOver(basesvg) {
            //console.log("In MouseOver");
            function timewaste (node) {
                console.log("DELAY");
                TerminalMenu(d3.event.pageX, d3.event.pageY, node);
            }
            var height,
                width,
                margin = 0.1, // fraction of width
                items = [],
                rescale = false,
                style = {
                    'rect': {
                        'mouseout': {
                            'fill': 'rgb(244,244,244)',
                            'stroke': 'white',
                            'stroke-width': '1px'
                        },
                        'mouseover': {
                            'fill': 'rgb(200,200,200)'
                        }
                    },
                    'text': {
                        'fill': 'steelblue',
                        'font-size': '12'
                    }
                };

            function TerminalMenu(x, y, items) {
                //d3.select('.onhover-menu').remove();
                scaleItems();
                //console.log("In termainl menu: ", items);
                var inst_name = /*items['instructors'][0].instructor_fName + " " + */items['instructors'][0].instructor_lName;
                var data1 = ['Class Info', items['id'], inst_name, items['meeting_pattern'][0].facility_name, items['section'], items['component']];

                basesvg.append("svg")
                    .append('g').attr('class', 'onhover-menu')
                    .selectAll('tmp')
                    .data(data1).enter()
                    .append('g').attr('class', 'menu-ent')
                    .style('fill', 'red')
                    .style({'cursor': 'pointer'});


                d3.selectAll('.menu-ent')
                    .append('rect')
                    .attr('x', x + 200)
                    .style('fill', 'pink')
                    .style('opacity', .4)
                    .attr('y', function(d, i){ return y + (i * height - 150); })
                    .attr('width', width + 65)
                    .attr('height', height);



                var TermOption = d3.selectAll('.menu-ent')
                    .append('text')
                    .text(function(d){ return d; })
                    .attr('x', x + 200)
                    .attr('y', function(d, i){ return y + (i * height - 150); })
                    .attr('dy', height - margin)
                    .attr('dx', margin)
                    .style("fill", "black")
                    .style("font", "12px times");

            }
            TerminalMenu.items = function(e) {
                if (!arguments.length) return items;
                for (i in arguments) items.push(arguments[i]);
                rescale = true;
                return TerminalMenu;
            }

            function scaleItems() {
                if (rescale) {
                    var option = d3.select('svg').selectAll('tmp')
                        .data(items).enter()
                        .append('text')
                        .text(function(d){ return d; })
                        .style(style.text)
                        .attr('x', -1000)
                        .attr('y', -1000)
                        .attr('class', 'tmp');
                    var z = d3.selectAll('.tmp')[0]
                        .map(function(x){ return x.getBBox(); });
                    width = d3.max(z.map(function(x){ return x.width; }));
                    margin = margin * width;
                    width =  width + 2 * margin;
                    height = d3.max(z.map(function(x){ return x.height + margin / 2; }));

                    // cleanup
                    d3.selectAll('.tmp').remove();
                    rescale = false;
                }
            }

            return TerminalMenu;
        }


        //data for context menu (right click)
        function contextMenu(baseSvg) {
            var height,
                width,
                margin = 0.1, // fraction of width
                items = [],
                rescale = false,
                style = {
                    'rect': {
                        'mouseout': {
                            'fill': 'rgb(244,244,244)',
                            'stroke': 'white',
                            'stroke-width': '1px'
                        },
                        'mouseover': {
                            'fill': 'rgb(200,200,200)'
                        }
                    },
                    'text': {
                        'fill': 'steelblue',
                        'font-size': '13'
                    }
                };


            //draw the context menu (right click)
            function menu(x, y, item) {
                d3.select('.context-menu').remove();
                scaleItems();

                // Draw the menu
                baseSvg.append("svg")
                //d3.select('svg')
                    .append('g').attr('class', 'context-menu')
                    .selectAll('tmp')
                    .data(items).enter()
                    .append('g').attr('class', 'menu-entry')
                    .style({'cursor': 'pointer'})
                    .on('mouseover', function(){
                        d3.select(this).select('rect').style(style.rect.mouseover) })
                    .on('mouseout', function(){
                        d3.select(this).select('rect').style(style.rect.mouseout) });


                d3.selectAll('.menu-entry')
                    .append('rect')
                    .attr('x', x)
                    .attr('y', function(d, i){ return y + (i * height); })
                    .attr('width', width + 15)
                    .attr('height', height + 7)
                    .style(style.rect.mouseout);

                var option = d3.selectAll('.menu-entry')
                    .append('text')
                    .text(function(d){ return d; })
                    .attr('x', x)
                    .attr('y', function(d, i){ return y + (i * height); })
                    .attr('dy', height - margin / 2)
                    .attr('dx', margin)
                    //.style(style.text)
                    .style("font", "16px times");



                //this makes the menu do something when you click on the options
                option.on('click', function(d){
                    console.log('You just clicked on: ', d);

                    var level = item.parent ? item.parent.depth + 1 : 0;
                    //console.log('level: ', level);

                    var opt = d[0] + d[1] + d[2]; //first three letters of the menu options

                    if(opt == 'Add'){ //SEND INFO TO DATABASE

                        create_node_parent = item;
                        create_node_active = true;

                        create_node( item, level);
                    }
                    else if(opt == 'Del'){ //SEND INFO TO DATABASE

                        delete_node(item); //delete item

                    }
                    else if(opt == 'Ren'){//SEND INFO TO DATABASE
                        node_to_rename = item;
                        rename_node_parent = item.parent;
                        rename_active = true;

                        rename_node(level); //rename node

                    }
                    else if(opt == 'Exp'){ //Expand all children of this node

                            expand(item);
                            update(root);

                    }
                    else if(opt == 'Col'){ //Expand all children of this node

                        collapse(item);
                        update(root);

                    }
                });


                // Other interactions
                d3.select('body')
                    .on('click', function() {
                        d3.select('.context-menu').remove();
                    });

            }

            menu.items = function(e) {
                if (!arguments.length) return items;
                for (i in arguments) items.push(arguments[i]);
                rescale = true;
                return menu;
            };

            // Automatically set width, height, and margin;
            function scaleItems() {
                if (rescale) {
                    var option = d3.select('svg').selectAll('tmp')
                        .data(items).enter()
                        .append('text')
                        .text(function(d){ return d; })
                        .style(style.text)
                        .attr('x', -1000)
                        .attr('y', -1000)
                        .attr('class', 'tmp');
                    var z = d3.selectAll('.tmp')[0]
                        .map(function(x){ return x.getBBox(); });
                    width = d3.max(z.map(function(x){ return x.width; }));
                    margin = margin * width;
                    width =  width + 2 * margin;
                    height = d3.max(z.map(function(x){ return x.height + margin / 2; }));

                    // cleanup
                    d3.selectAll('.tmp').remove();
                    rescale = false;
                }
            }

            return menu;
        }


        //deletes node, and its children
        function delete_node(node) {

            visit(fullObj, function(d) {

                    var i = 0;
                    if(d.children)
                        for (var child of d.children) {
                            if (child == node) {

                                d.children.splice(i,1); //delete from the object

                                //update all parent nodes to reflect update
                                node_to_update = node.parent;

                                while(node_to_update){
                                    console.log(node_to_update);
                                    node_to_update.is_updated = true;
                                    node_to_update = node_to_update.parent;

                                }
                                update(root); //update the tree

                                break;
                            }
                            i++;
                        }
                },
                function(d) {
                    return d.children && d.children.length > 0 ? d.children : null;
                });




        }



        //this function does the actual adding of the class to the data
        function create_node_helper(className){

            if (create_node_parent && create_node_active) {
                if (create_node_parent._children != null)  {
                    create_node_parent.children = create_node_parent._children;
                    create_node_parent._children = null;
                }
                if (create_node_parent.children == null) {
                    create_node_parent.children = [];
                }

                if(update_count == 0){
                    console.log(update_count);
                    base_root_num = root.id;
                    update_count = base_root_num;
                    console.log(update_count);
                }
                var ids = root.id + update_count + 1; //unique id is required for all nodes

                //new node structure
                new_node = { 'name': className,
                    'id' :  ids,
                    'depth': create_node_parent.depth + 1,
                    'children': [],
                    '_children': null,
                    'is_updated' : true
                };

                create_node_parent.children.push(new_node);
                create_node_active = false;


                //make all parent nodes turn red when a child node is added
                //to do this, change the id of all parent nodes of an added node
                node_to_update = create_node_parent;
                while(node_to_update){
                    console.log(node_to_update);
                    node_to_update.is_updated = true;
                    node_to_update = node_to_update.parent;
                }

            }

            update(create_node_parent); //Update the tree
            create_node_parent = new_node;

        }



        //this function adds a new child node to create_node_parent, with the help of create_node_helper
        function create_node(item, level) {
            //this is the pre-processing section of adding a node, different information can be added at different levels
            if(level == 0){

                let input = prompt("Enter A Catalog Number", "100");
                if(input != null){
                    className = "CS-" + input; //automatically add CS- to the name of the node
                    create_node_helper(className, update_count);
                    update_count ++;
                }
            }
            else if(level == 1 ){
                let input = prompt("Enter a Class Number", "1000");
                if(input != null){

                    let term_number = " 2187 ";
                    className = item.name + term_number + input; //automatically add parent name to the name of the new node
                    create_node_helper(className, update_count);
                    update_count ++;
                }
            }
            else if(level == 2){
                if(item.children == null && item._children == null){
                    let input = prompt("Enter Course Title", "Intro To Typing");
                    if(input != null) {
                        className = input;
                    }
                }
                else if(item.children != null){ //expanded children check
                    if(item.children[0].course_title == null){

                        className = item.children[0].name;
                    }else{

                        className = item.children[0].course_title;
                    }

                }
                else if(item._children != null){//collapsed children check
                    if(item._children[0].course_title == null){

                        className = item._children[0].name;
                    }else{

                        className = item._children[0].course_title;
                    }

                }

                create_node_helper(className, update_count);
                update_count ++;

            }
            else if(level == 3 ){//this is last layer
                let input = prompt("Activity", "ACT/LAB");
                if(input != null) {
                    update_count ++;

                    if(item.children != null || item._children != null){ //one of them is populated
                        let nextItem = create_node_parent;
                        if(input == "LAB" || input == "ACT") {
                            //creates whole new section
                            create_node_parent = item.parent;
                            if(item.name == null){

                                className = item.course_title; //adds a new combined level
                            }else{
                                className = item.name;
                            }
                            create_node_helper(className, update_count);
                            update_count++;



                            create_node_active = true;
                            nextItem = create_node_parent;
                            create_node_helper("DIS", update_count);//automatically adds a discussion section
                            update_count ++;
                        }
                        else{//if input not act or lab...

                            if(item.children != null){ //check if children are expanded
                                if(item.children.length > 1){ //if 2 or more children, add another layer
                                    //add another layer
                                    create_node_parent = item.parent;
                                    if(item.name == null){

                                        className = item.course_title;  //adds a new combined level
                                    }else{

                                        className = item.name;
                                    }
                                    create_node_helper(className, update_count);
                                    update_count++;

                                    nextItem = create_node_parent;
                                }
                            }
                            else if(item._children != null){//check if children are collapsed

                                if(item._children.length > 1){//if 2 or more children, add another layer
                                    //add another layer
                                    create_node_parent = item.parent;
                                    if(item.name == null){
                                        className = item.course_title; //adds a new combined level
                                    }else{
                                        className = item.name;
                                    }
                                    create_node_helper(className, update_count);
                                    update_count++;
                                    nextItem = create_node_parent;
                                }
                            }
                        }


                        create_node_parent = nextItem;
                        className = input;  //adds the input name
                        create_node_active = true;
                    }
                    else{ //no children
                        console.log("no children");

                        if(input == "LAB" || input == "ACT"){ //only auto add DIS if input is LAB or ACT
                            create_node_parent = item;
                            create_node_active = true;

                            create_node_helper("DIS", update_count);
                            update_count ++;
                        }

                        //add input
                        create_node_parent = item;

                        className = input;
                        create_node_active = true;

                    }

                    create_node_helper(className, update_count);
                    update_count ++;
                    update(item);

                }
            }
        }



        //allows the user to rename, but guides the user based on the level of the node_to_rename/level
        function rename_node(level) {

            let input;
            let className;
            if (node_to_rename && rename_active) {

                if(level == 1){

                    input = prompt("Enter A Catalog Number", "100");
                    if(input != null){

                        className = "CS-" + input; //automatically add CS- to the name of the node

                        node_to_rename.name = className;
                    }

                }
                else if(level == 2 ){
                    input = prompt("Enter a Class Number", "1000");
                    if(input != null){

                        let term_number = " 2187 "; //term number for entire json

                        className = rename_node_parent.name + term_number + input; //automatically add parent name to the name of the new node

                        node_to_rename.name = className;
                    }

                }
                else if(level == 3){
                    console.log("Level 3");

                        input = prompt("Enter Course Title", "Intro To Typing");

                        if(input != null) {
                                 node_to_rename.parent.children.forEach((value) => {
                                    value.name = input;
                                    value.is_updated = true;
                                });
                            }
                }
                else if(level == 4 ){//this is last layer, at this layer, user can only rename the component of the course (ACT, LAB, SEM)
                    //in further iterations of this project, user will be able to update more here
                    input = prompt("Activity", "ACT/LAB");
                    if(input != null) {

                        console.log(node_to_rename);
                        node_to_rename.component = input;
                    }

                    update(node_to_rename); //update the tree

                }
                rename_active = false; //stop renaming
            }
            //update all parent nodes to reflect update
            //node_to_update = node_to_update;

            node_to_update = node_to_rename;
            while(node_to_update){
                node_to_update.is_updated = true;
                node_to_update = node_to_update.parent;
            }

            update(node_to_rename); //update the tree

        }
    });


}




