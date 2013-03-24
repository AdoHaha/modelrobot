


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

window.robotlinkcollection=new App.RobotLinkCollection();
window.robotjointcollection=new App.RobotJointCollection();


xmelon=$.parseXML(xml); // to be able to access the DOM  
//console.log($.xml2json(xmelon));
var robotBaseMaterial = new THREE.MeshPhongMaterial( { color: 0x6E23BB, specular: 0x6E23BB, shininess: 20 } );
//	console.log($.xmlTojson(xmelon));
var robot=new THREE.Object3D();
robot.name="robot";
//console.log("namespace "+this.namespace);
//console.log(xml);
  //find every Tutorial and print the author
  $(xmelon).find("link").each(function( index)
  {
  var robotlink=new App.RobotLink($.xml2json(this))
  window.robotlinkcollection.add(robotlink);
  
 
	//console.log(robotlink.get("link"));
	robot.add(robotlink.get("link"));

  });
   $(xmelon).find("joint").each(function( index)
  {
  var robotjoint=new App.RobotJoint($.xml2json(this));
  robotjoint.set("linkcollection",window.robotlinkcollection);
  window.robotjointcollection.add(robotjoint);
  
 
	//console.log(robotlink.get("link"));
	//robot.add(robotlink.get("link"));

  });
  

//console.log(robot);
  // Output:
  // The Reddest
  // The Hairiest
  // The Tallest
  // The Fattest
  scene.add(robot);
 // console.log(scene);
 renderer.render(scene, camera);
}

