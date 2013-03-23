var robot;




// set the scene size
var WIDTH = 400,
  HEIGHT = 300;

// set some camera attributes
var VIEW_ANGLE = 45,
  ASPECT = WIDTH / HEIGHT,
  NEAR = 0.1,
  FAR = 10000;

// get the DOM element to attach to
// - assume we've got jQuery to hand
var $container = $('#container');
//console.log($container);
// create a WebGL renderer, camera
// and a scene
var renderer = new THREE.WebGLRenderer();
var camera =
  new THREE.PerspectiveCamera(
    VIEW_ANGLE,
    ASPECT,
    NEAR,
    FAR);

var scene = new THREE.Scene();

// add the camera to the scene
scene.add(camera);

// the camera starts at 0,0,0
// so pull it back
camera.position.z = 300;




// start the renderer
renderer.setSize(WIDTH, HEIGHT);


/*
$(document).ready(function()
{
  $.ajax({
    type: "GET",
    url: "../testowe/06-flexible.urdf",
    dataType: "xml",
    success: parseRobot
  });
});

*/
function parseRobot(xml)
{
xmelon=$.parseXML(xml);
var robotBaseMaterial = new THREE.MeshPhongMaterial( { color: 0x6E23BB, specular: 0x6E23BB, shininess: 20 } );
	
var robot=new THREE.Object3D();
robot.name="robot";
//console.log("namespace "+this.namespace);
//console.log(xml);
  //find every Tutorial and print the author
  $(xmelon).find("link").each(function( index)
  {
  console.log($(this).children());
  // console.log($(this).find("visual").html());
  //console.log(visual.find("geometry > box"));
  //console.log(visual.find("geometry > box").length);
  if ($visual.find("geometry > box").length==1)
  {
  console.log("sukces");
  var link= new THREE.Object3D();
 link.name=$(this).attr("name");
 var length=50;
 var box = new THREE.Mesh( 
			new THREE.CubeGeometry( 4, length, 4 ), robotBaseMaterial );
		box.position.x = index*5;
		link.add(box);
		robot.add(link);
  }
 // console.log($(this).attr("name"));
 //console.log(this)
 
  //  $("#output").append($(this).attr("name") + "<br />");
	
  });
console.log(robot);
  // Output:
  // The Reddest
  // The Hairiest
  // The Tallest
  // The Fattest
  scene.add(robot);
 // console.log(scene);
 // renderer.render(scene, camera);
}

