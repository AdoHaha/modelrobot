


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
  
 //  console.log("sukces");
 /*
  var link= new THREE.Object3D();
  var scale=1;
 link.name=$(this).attr("name");
  $visual=$(this).find("visual");
 
  if ($visual.find("geometry > box").length==1)
  {
	  var boxsize=$visual.find("geometry > box").attr("size")||"0 0 0";
	  boxsize=boxsize.split(' ')||[0,0,0];
	//  console.log(boxsize);
	  var length=50;
	 var meshvis = new THREE.Mesh( 
				new THREE.CubeGeometry( boxsize[0]*scale,boxsize[1]*scale, boxsize[2]*scale ), robotBaseMaterial );
	}
	else if($visual.find("geometry > cylinder").length==1)
	{
	
	  var length=$visual.find("geometry > cylinder").attr("length")||"0";
	  var radius=$visual.find("geometry > cylinder").attr("radius")||"0";
	 // boxsize=boxsize.split(' ')||[0,0,0];
	 // console.log(boxsize);
	 // var length=50;
	 var meshvis = new THREE.Mesh( 
				new THREE.CylinderGeometry( radius,radius, length,500,1 ), robotBaseMaterial );

	
	
	}
	else
	{
	//console.log($visual);
	var meshvis = new THREE.Mesh();
	}
			
  var position=$visual.find("origin").attr("xyz")||"0 0 0";
  position=position.split(' ')||[0,0,0];
  
  var orientation=$visual.find("origin").attr("rpy")||"0 0 0";
  orientation=orientation.split(' ')||[0,0,0];
  
 // <origin rpy="0 1.57075 0" xyz="0 0 -0.3"/>
 ".1 0.4 .1"
 
			
		meshvis.position.set(position[0], position[1],position[2]);// = index*1.05;
	//	console.log(meshvis.position);
		meshvis.rotation.set(orientation[0],orientation[1],orientation[2]);
		link.add(meshvis);
		
		*/
		console.log(robotlink.get("link"));
		robot.add(robotlink.get("link"));
  
 // console.log($(this).attr("name"));
 
 //console.log(this)
  //  $("#output").append($(this).attr("name") + "<br />");
	
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
