Setting the scene
=================
This file sets whole scene for showing robot model, it is based on files from Interactive 3D Graphics course at Udacity, by Eric Haines


Global variables
---------------
there are also Coordinates and dat (??)
        window.App = window.App||{};
        
        App.gridX = false
        App.gridY = false
        App.gridZ = false
        
        App.axes=true
        App.ground = false
        
        
        App.clock = new THREE.Clock();




Static scene filling
-------------------

        App.fillScene = ->
                window.scene = window.scene || new THREE.Scene
                scene.fog = new THREE.Fog 0x808080,2000,4000
                
                ambientLight = new THREE.AmbientLight 0x222222
                light = new THREE.DirectionalLight 0xffffff, 1.0 
                light.position.set(200,-400,500)
                
                light2 = new THREE.DirectionalLight( 0xffffff, 1.0 );
                
                light2.position.set(73,184,184)
                
                scene.add(ambientLight)
                scene.add(light)
                
                if App.ground
                        Coordinates.drawGround({size:10000})
                
                if App.gridX
                        Coordinates.drawGrid({size:10000,scale:0.01});
                        
                if App.gridZ
                        Coordinates.drawGrid({size:10000,scale:0.01, orientation:"z"});
                        
                if App.axes
                        Coordinates.drawAllAxes({axisLength:2,axisRadius:0.01,axisTess:50});
                        
                window.robotBaseMaterial = new THREE.MeshPhongMaterial( { color: 0x6E23BB, specular: 0x6E23BB, shininess: 20 } );
                window.robotForearmMaterial = new THREE.MeshPhongMaterial( { color: 0xF4C154, specular: 0xF4C154, shininess: 100 } );
                window.robotUpperArmMaterial = new THREE.MeshPhongMaterial( { color: 0x95E4FB, specular: 0x95E4FB, shininess: 100 } );
                true
		

Seting initial parameters
-------------------------
		
        App.init = ->
                
                canvasWidth = window.innerWidth;
                canvasHeight = window.innerHeight;
                canvasRatio = canvasWidth / canvasHeight
                window.renderer = new THREE.WebGLRenderer { antialias: true}

                renderer.gammaInput = true
                renderer.gammaOutput = true
                renderer.setSize(canvasWidth, canvasHeight);
                renderer.setClearColorHex( 0xAAAAAA, 1.0 );
                container = document.getElementById('container')
                container.appendChild( renderer.domElement );
	        
seting CAMERA params

                camera = new THREE.PerspectiveCamera(30, canvasRatio, 1, 10000)
        	
                camera.position.set( 2.5, 2, 4 );
                camera.up = new THREE.Vector3( 0, 0, 1 );
                
setting CONTROLS params
                App.camera=camera
                App.cameraControls = new THREE.OrbitAndPanControls(camera, renderer.domElement);
                #cameraControls.target.set(0.1,0,0);
	        #cameraControls.object.lookAt
	        App.fillScene();
	        true

Controlling scene, using dat gui
----------------

        App.setupGui = ->
                window.effectController = 
                
                        newGridX: App.gridX
                        newGridY: App.gridY
                        newGridZ: App.gridZ
                        newGround: App.ground
                        newAxes: App.axes
        
                        uy: 70.0
                        uz: -15.0
                        swiatlox:-500
                        swiatloy:250
                        swiatloz:-200
                        fy: 10.0
                        fz: 60.0
                if _.has(App,"gui")
    
                        App.gui.destroy()
    
                App.gui = new dat.GUI();
                true
Creating gui for robot
                App.robotjointmanipall= new App.RobotJointManipAll({gui:App.gui, joints: window.robotjointcollection});                	        

helper function takeScreenShot, will take screenshot when P is pressed
It opens new window, where it shows work as a png, for easy saving

        App.takeScreenshot = ->
                #effectController.newGround = true, effectController.newGridX = false, effectController.newGridY = false,          #effectController.newGridZ = false, effectController.newAxes = false;
                #init();
                App.render();
                img1 = window.renderer.domElement.toDataURL("image/png");
                #camera.position.set( 400, 500, -800 );
                
        
                imgTarget = window.open('', 'For documenting your work');
                imgTarget.document.write('<img src="'+img1+'"/>');
                true
	        
Function to animate our scene
------------

        App.animate = ->
                window.requestAnimationFrame(App.animate);
                App.render()
                true
                
        App.render = ->
                delta = App.clock.getDelta()
                App.cameraControls.update(delta)
                
                if ( effectController.newGridX != App.gridX || effectController.newGridY != App.gridY || effectController.newGridZ != App.gridZ || effectController.newGround != App.ground || effectController.newAxes != App.axes)
                        App.gridX = effectController.newGridX;
                        App.gridY = effectController.newGridY;
                        App.gridZ = effectController.newGridZ;
                        App.ground = effectController.newGround;
                        App.axes = effectController.newAxes;

                        App.fillScene();
                window.renderer.render(scene,App.camera)
                true
                
Starting it all
------------

        $(document).ready(App.init)
        forumula = new App.RobotForm();
        $ ->
                $.when($.get("../testowe/pi_robot_urdf.urdf",window.parseRobot)).then( ->
                        App.setupGui();
                        App.animate();
                      )
                
               


#        $("body").keydown( event -> 
#            if (event.which == 80) 
#                takeScreenshot();
            
#        )         
