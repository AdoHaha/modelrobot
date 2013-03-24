#program zrobiony przez Igora
  
window.App = window.App||{};

App.el2array= (el,def="0 0 0",check)-> #returns array of numbers or default array from string
	el2array=(check&&el)||def
	arrayw=el2array.split(" ")
	arrayw=_.map(arrayw,(num)-> num*1)
	arrayw
class App.RobotJoint extends Backbone.Model
	
	###
 <joint name="gripper_extension" type="prismatic">
    <parent link="base_link"/>
    <child link="gripper_pole"/>
    <limit effort="1000.0" lower="-0.38" upper="0" velocity="0.5"/>
    <origin rpy="0 0 1.57075" xyz="0 0.19 .2"/>
	  <axis xyz="0 0 1"/>
	###
	initialize: ->
		@theta=0
		
		axis=App.el2array(_.has(@attributes,"axis")&&@attributes.axis.xyz,"1 0 0");
			#xis=axis.split(" ")
		@axis=new THREE.Vector3(axis[0],axis[1],axis[2])
		rotation=App.el2array(_.has(@attributes,"origin")&&@attributes.origin.rpy,"0 0 0")
		@basicrotation=new THREE.Vector3(rotation[0],rotation[1],rotation[2])
		position=App.el2array(_.has(@attributes,"origin")&&@attributes.origin.xyz,"0 0 0")
		@basicposition=new THREE.Vector3(position[0],position[1],position[2])
		
		@lower=@arguments.lower||-Infinity
		@upper=@arguments.upper||Infinity
		
		basicMatrix=new THREE.Matrix4()
		@movementMatrix=new THREE.Matrix4()
		basicMatrix.setRotationFromEuler(@basicrotation)
		basicMatrix.setPosition(@basicposition)
		@basicMatrix=basicMatrix
		@currentMatrix=new THREE.Matrix4();
		#else
		#	@axis= new THREE.Vector3(1,0,0)
		@type=@arguments.type;
		@on("change:linkcollection",@jointogether)
		@
	jointogether: => #if possible, we make connection between two 3d link objects
		if (_.has(@attributes,"parent")&&_.has(@attributes,"child")&&_.has(@attributes,"linkcollection"))
			child=@get(linkcollection).get(@attributes.child.link);
			parent=@get(linkcollection).get(@attributes.child.parent);
			
			
			#parent.get("link"). add(child.get("link"));
			@parentobject3d=parent.get("link")
			@childobject3d=child.get("link")
			@parentobject3d.add(@childobject3d);
			@childobject3d.matrixAutoUpdate=false
			@childobject3d.matrix=basicMatrix
			
	movejoint: (t1,t2)-> #TODO planar type
		t1=t1||@theta
		tempMatrix=new THREE.Matrix4();
		tempaxis= new THREE.Vector3().copy(@axis);
		#@currentMatrix=new TH
		if (@type=="continuous" or (t1<@upper and t1>@lower)) #check whether movement is allowed
			switch @type
				when "revolute" then @movementMatrix=tempMatrix.rotateByAxis(@axis,t1)
				when "continuous" then @movementMatrix=tempMatrix.rotateByAxis(@axis,t1)
				when "prismatic" then @movementMatrix=tempMatrix.translate(tempaxis.multiplyScalar(t1))
				when "fixed" then @movementMatrix.identity()
				when "planar" then @movementMatrix.identity() #TODO
		@currentmatrix.multiplyMatrices(@movementMatrix,@basicMatrix)
		@childobject3d.matrix=@currentmatrix
			
			
		

class App.RobotLink extends Backbone.Model
	robotBaseMaterial = new THREE.MeshPhongMaterial( { color: 0x6E23BB, specular: 0x6E23BB, shininess: 20 } );
	initialize: ->
		@id=@get("name");
		@makeobject3d(); #adds link attribute, consisting of created mesh
		link=new THREE.Object3D();
		link.name=@get("name")
		link.add(@meshvis)
		
		@set("link",link)
		@
	makeobject3d: ->
		if(_.has(@attributes,"visual"))
			if(_.has(@attributes.visual.geometry,"box"))
				boxsize=App.el2array(@attributes.visual.geometry.box.size,"0 0 0");
				#boxsize=boxsize.split(' ')||[0,0,0];
				
			
				@makebox(boxsize);
			else if(_.has(@attributes.visual.geometry,"cylinder"))
				length=@attributes.visual.geometry.cylinder.length||0;
				radius=@attributes.visual.geometry.cylinder.radius||0;
				@makecylinder(length,radius);
			else
				@makeempty();
			
			position=App.el2array(_.has(@attributes.visual,"origin")&&@attributes.visual.origin.xyz,"0 0 0")
		#	(_.has(@attributes.visual,"origin")&&@attributes.visual.origin.xyz)||"0 0 0";
		#	position=position.split(' ')||[0,0,0];
			orientation=App.el2array(_.has(@attributes.visual,"origin")&&@attributes.visual.origin.rpy,"0 0 0")
			
		#	(_.has(@attributes.visual,"origin")&&@attributes.visual.origin.rpy)||"0 0 0";
			#orientation=orientation.split(' ')||[0,0,0];
			@meshvis.position.set(position[0], position[1],position[2]);
		
			@meshvis.rotation.set(orientation[0],orientation[1],orientation[2]);
			@
			
		else
			console.log("there are no visual attributes");
			@makeempty();
			@
	makecylinder: (length,radius) ->
		@meshvis = new THREE.Mesh( 
				new THREE.CylinderGeometry( radius,radius, length,500,1 ), @robotBaseMaterial );
		
	makebox: (boxsize) ->
		@meshvis = new THREE.Mesh( 
				new THREE.CubeGeometry( boxsize[0]*1,boxsize[1]*1, boxsize[2]*1 ), @robotBaseMaterial );
	makeempty: ->
		@meshvis = new THREE.Mesh();
		
		
class App.RobotLinkCollection extends Backbone.Collection
	model:App.RobotLink
	
class App.RobotJointCollection extends Backbone.Collection
	model:App.RobotJoint