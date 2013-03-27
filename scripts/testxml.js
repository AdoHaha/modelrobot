


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
camera.up = new THREE.Vector3( 1, 0, 0 );
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
window.robotmaterialcollection=new App.RobotMaterialCollection();
window.robotlinkcollection=new App.RobotLinkCollection();
window.robotjointcollection=new App.RobotJointCollection();


xmelon=$.parseXML(xml); // to be able to access the DOM  
//console.log($.xml2json(xmelon));
var robotBaseMaterial = new THREE.MeshPhongMaterial( { color: 0x6E23BB, specular: 0x6E23BB, shininess: 50 } );
//	console.log($.xmlTojson(xmelon));
window.robot=new THREE.Object3D();
window.robot.name="robot";
//console.log("namespace "+this.namespace);
//console.log(xml);
  //find every Tutorial and print the author
  $(xmelon).find("color").parent().each(function(index)
  {
  var robotcolor=new App.RobotMaterial($.xml2json(this));
  window.robotmaterialcollection.add(robotcolor);
  }
  );
  
  
  $(xmelon).find("link").each(function( index)
  {
  var tjson=$.xml2json(this);
  tjson["materialcollection"]=window.robotmaterialcollection;
  var robotlink=new App.RobotLink(tjson);
  //robotlink.set(tjson);
  window.robotlinkcollection.add(robotlink);
  
 
	//console.log(robotlink.get("link"));
	window.robot.add(robotlink.get("link"));

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
  scene.add(window.robot);
 // console.log(scene);
 renderer.render(scene, camera);
}

