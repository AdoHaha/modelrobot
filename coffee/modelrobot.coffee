#program zrobiony przez Igora
  
window.App = window.App||{};

App.el2array= (el,def="0 0 0",check=true)-> #returns array of numbers or default array from string
	el2array=(check&&el)||def
	arrayw=el2array.split(" ")
	arrayw=_.map(arrayw,(num)-> num*1)
	arrayw
class App.RobotJoint extends Backbone.Model


	initialize: ->
		@theta=0
		@name=@attributes.name
		axis=App.el2array(_.has(@attributes,"axis")&&@attributes.axis.xyz,"1 0 0");
			#xis=axis.split(" ")
		@axis=new THREE.Vector3(axis[0],axis[1],axis[2])
		rotation=App.el2array(_.has(@attributes,"origin")&&@attributes.origin.rpy,"0 0 0")
		@basicrotation=new THREE.Vector3(rotation[0],rotation[1],rotation[2])
		position=App.el2array(_.has(@attributes,"origin")&&@attributes.origin.xyz,"0 0 0")
		@basicposition=new THREE.Vector3(position[0],position[1],position[2])
		
		@lower=(_.has(@attributes,"limit")&&@attributes.limit.lower)||-Math.PI # could be -Infinity
		@upper=(_.has(@attributes,"limit")&&@attributes.limit.upper)|| Math.PI #could be Infinity
		@lower=@lower*1
		@upper=@upper*1


		basicMatrix=new THREE.Matrix4()
		@movementMatrix=new THREE.Matrix4()
		basicMatrix.setRotationFromEuler(@basicrotation)
		basicMatrix.setPosition(@basicposition)
		@basicMatrix=basicMatrix
		@currentMatrix=new THREE.Matrix4();


		@type=@attributes.type;
		@on("change:linkcollection",@jointogether)
		@
	jointogether: => #if possible, we make connection between two 3d link objects
		if (_.has(@attributes,"parent")&&_.has(@attributes,"child")&&_.has(@attributes,"linkcollection"))
			child=@get("linkcollection").get(@attributes.child.link);
			parent=@get("linkcollection").get(@attributes.parent.link);
			
			
			#parent.get("link"). add(child.get("link"));
			@parentobject3d=parent.get("link")
			@childobject3d=child.get("link")
			@parentobject3d.add(@childobject3d);
			@childobject3d.matrixAutoUpdate=false
			@childobject3d.matrix=@basicMatrix
			
	movejoint: (t1,t2) => #TODO planar type
		t1=t1||@theta

		tempMatrix=new THREE.Matrix4();
		tempaxis= new THREE.Vector3().copy(@axis);

		if (@type=="continuous" or (t1<@upper and t1>@lower)) #check whether movement is allowed
			switch @type
				when "revolute" then @movementMatrix=tempMatrix.rotateByAxis(@axis,t1)
				when "continuous" then @movementMatrix=tempMatrix.rotateByAxis(@axis,t1)
				when "prismatic" then @movementMatrix=tempMatrix.translate(tempaxis.multiplyScalar(t1))
				when "fixed" then @movementMatrix.identity()
				when "planar" then @movementMatrix.identity() #TODO
			@theta=t1 #set current state of joint
		@currentMatrix.multiplyMatrices(@basicMatrix,@movementMatrix)
		@childobject3d.matrix=@currentMatrix
		
		@	
			
		

class App.RobotLink extends Backbone.Model
	
	initialize: ->
		@robotBaseMaterial = new THREE.MeshPhongMaterial( { color: 0x6E23BB, specular: 0x6E23BB, shininess: 10 } );
		@id=@get("name");
		@makeobject3d(); #adds link attribute, consisting of created mesh
		link=new THREE.Object3D();
		link.name=@get("name")
		link.add(@meshvis)
		
		@set("link",link)
		@
	makeobject3d: ->
		if(_.has(@attributes,"visual"))
			if(_.has(@attributes.visual,"material"))

				color=@get("materialcollection").get(@attributes.visual.material.name).get("color");#||new THREE.Color(0x6E23BB);
				@robotBaseMaterial.color=color;
				@robotBaseMaterial.specular=color;
				@robotBaseMaterial.color=color;


			if(_.has(@attributes.visual.geometry,"box"))
				boxsize=App.el2array(@attributes.visual.geometry.box.size,"0 0 0");
				#boxsize=boxsize.split(' ')||[0,0,0];
				
			
				@makebox(boxsize);
			else if(_.has(@attributes.visual.geometry,"cylinder"))
				length=@attributes.visual.geometry.cylinder.length||0;
				radius=@attributes.visual.geometry.cylinder.radius||0;
				@makecylinder(length,radius);
			else if(_.has(@attributes.visual.geometry,"sphere"))
				radius=@attributes.visual.geometry.sphere.radius||0;
				@makesphere(radius);
			else
				@makeempty();
			
			position=App.el2array(_.has(@attributes.visual,"origin")&&@attributes.visual.origin.xyz,"0 0 0")
			
			orientation=App.el2array(_.has(@attributes.visual,"origin")&&@attributes.visual.origin.rpy,"0 0 0")
			@meshvis.position.set(position[0], position[1],position[2]);
		#	console.log(@meshvis.position)
			@meshvis.rotation.set(orientation[0],orientation[1],orientation[2]);
		#	console.log(@meshvis.rotation)
			@
			
		else
			console.log("there are no visual attributes");
			@makeempty();
			@
	makecylinder: (length,radius) ->
		meshvis = new THREE.Mesh( 
				new THREE.CylinderGeometry( radius,radius, length,500,1 ), @robotBaseMaterial );
		meshvis.rotation=new THREE.Vector3(Math.PI/2,0,0)
		@meshvis=new THREE.Mesh()
		@meshvis.add(meshvis)
	makebox: (boxsize) ->
		@meshvis = new THREE.Mesh( 
				new THREE.CubeGeometry( boxsize[0]*1,boxsize[1]*1, boxsize[2]*1 ), @robotBaseMaterial );
				
	makesphere: (radius) ->
		@meshvis = new THREE.Mesh( 
				new THREE.SphereGeometry( radius,20,20 ), @robotBaseMaterial );
		
	makeempty: ->
		@meshvis = new THREE.Mesh();
		
	clearthislink: => 
		@destroy()
		
	
class App.RobotMaterial extends Backbone.Model
	initialize: ->
		@id=@get("name")
		#color rgba
		if(_.has(@attributes,"color"))
			
			rgba=App.el2array(_.has(@attributes.color,"rgba")&&@attributes.color.rgba,def="0 0 0 1",check=true)
			@set("color",new THREE.Color().setRGB(rgba[0],rgba[1],rgba[2]))
		@
class App.RobotMaterialCollection extends Backbone.Collection
	model:App.RobotMaterial
	
class App.RobotLinkCollection extends Backbone.Collection
	model:App.RobotLink
	
class App.RobotJointCollection extends Backbone.Collection
	model:App.RobotJoint
	
	
class App.RobotJointManipAll extends Backbone.View
	el: $("#menu")
	jointsarray:{}
	
	initialize: ->
		#console.log(@options.gui)
		@gui=@options.gui|| new dat.GUI();
		@joints=@options.joints
		
		@anglesfolder=@gui.addFolder("Joint values");
		@joints.each(@add2gui)
	#	console.log(@gui)
	#	console.log("angles folder");
	#	console.log(@anglesfolder)
	add2gui: (joint) =>
		@jointsarray[joint.get("name")]= new App.RobotJointManipSingle({joint:joint,gui:@anglesfolder})

#gui for each element. 
class App.RobotJointManipSingle extends Backbone.View

	initialize:->
		#console.log("intialize robotjointmanipsingle");
		@joint=@options.joint
		@gui=@options.gui
		@dummy={}
		@dummy["val"]=0;
		#console.log(@joint.upper);
		if(@joint.type!="fixed")
			@controller=@gui.add(@dummy,"val",@joint.lower,@joint.upper,0.01).name(@joint.get("name"))
			@controller.onChange(@changeval)
		
	changeval: (value) =>
		@joint.movejoint(value)
#		console.log( "new value" + value)

window.clearall = (scene,robot,jointcollection,modelcollection) ->
		scene.remove(robot)
		#jointcollection.each( (joint) -> joint.destroy())
		jointcollection.reset()
		#modelcollection.each( (link) -> link.destroy())
		
		modelcollection.reset()
		


class App.RobotForm extends Backbone.View
	el: $("#robodiv")
	events:
		"click #loadbutton": "resetNload"
		
	resetNload: ->
	#	console.log("fufu2")
		urdffromform=$(@el).find("#robottext").val()
		window.clearall(window.scene,window.robot,window.robotjointcollection,window.robotlinkcollection)
		window.parseRobot(urdffromform);
		App.setupGui()
		console.log(urdffromform)
