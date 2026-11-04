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


        App.clock = new THREE.Timer();




Static scene filling
-------------------

        App.fillScene = ->
                window.scene = window.scene || new THREE.Scene
                scene.fog = new THREE.Fog 0x808080,2000,4000

                ambientLight = new THREE.AmbientLight 0x222222
                light = new THREE.DirectionalLight 0xffffff, 0.7
                light.position.set(200,-400,500)

                light2 = new THREE.DirectionalLight( 0xffffff, 1.0 );

                light2.position.set(73,184,184)


                dirLight = new THREE.DirectionalLight( 0xffffff, 1 );

                dirLight.color.setHSL( 0.1, 1, 0.95 );
                dirLight.position.set( 0, 40, 0 );
                dirLight.position.multiplyScalar( 50 );

                scene.add( dirLight );
                scene.add(ambientLight)
                scene.add(light)
                scene.add(dirLight);
                if App.sceneHelpers?
                        scene.remove(App.sceneHelpers)
                        App.sceneHelpers.traverse (object) ->
                            object.geometry?.dispose()
                            object.material?.dispose()
                App.sceneHelpers=new THREE.Group()
                scene.add(App.sceneHelpers)
                if App.ground
                        App.sceneHelpers.add(new THREE.GridHelper(100,100))

                if App.gridX
                        App.sceneHelpers.add(new THREE.GridHelper(100,100))

                if App.gridZ
                        grid=new THREE.GridHelper(100,100)
                        grid.rotation.x=Math.PI/2
                        App.sceneHelpers.add(grid)

                if App.axes
                        App.sceneHelpers.add(new THREE.AxesHelper(2))

                window.robotBaseMaterial = new THREE.MeshPhongMaterial( { color: 0x6E23BB, specular: 0x6E23BB, shininess: 20 } );
                window.robotForearmMaterial = new THREE.MeshPhongMaterial( { color: 0xF4C154, specular: 0xF4C154, shininess: 100 } );
                window.robotUpperArmMaterial = new THREE.MeshPhongMaterial( { color: 0x95E4FB, specular: 0x95E4FB, shininess: 100 } );
                true


Seting initial parameters
-------------------------


        App.init = ->

                container = document.getElementById('container')
                canvasWidth = container.clientWidth
                canvasHeight = container.clientHeight
                canvasRatio = canvasWidth / canvasHeight
                window.renderer = new THREE.WebGLRenderer { antialias: true, preserveDrawingBuffer: true}

                window.renderer.setPixelRatio(Math.min(window.devicePixelRatio,2))
                window.renderer.setSize(canvasWidth, canvasHeight);
                #window.renderer.setClearColorHex();
                window.renderer.setClearColor(new THREE.Color(0xdfe7ef), 1.0 );
                container = document.getElementById('container')
                container.appendChild( window.renderer.domElement );

seting CAMERA params

                camera = new THREE.PerspectiveCamera(30, canvasRatio, 1, 10000)

                camera.position.set( 2.5, 2, 4 );
                camera.up = new THREE.Vector3( 0, 0, 1 );

setting CONTROLS params

                App.camera=camera
                App.cameraControls = new THREE.TrackballControls(camera, renderer.domElement);
                App.cameraControls.rotateSpeed=4
                App.cameraControls.target.set(0,0,0);

                #cameraControls.object.lookAt
                App.fillScene();
                wasMobile=window.innerWidth<760
                resizeViewer = ->
                    width=Math.max(1,container.clientWidth)
                    height=Math.max(1,container.clientHeight)
                    renderer.setPixelRatio(Math.min(window.devicePixelRatio,2))
                    renderer.setSize(width,height)
                    App.camera.aspect=width/height
                    App.camera.updateProjectionMatrix()
                    App.cameraControls.handleResize()
                    isMobile=window.innerWidth<760
                    if isMobile isnt wasMobile
                        App.gui.close() if isMobile and App.gui?
                        App.fitRobot() if window.robot?
                        wasMobile=isMobile
                document.getElementById('view-cube').addEventListener 'click', (event) ->
                    button=event.target.closest('[data-view]')
                    return unless button?
                    name=button.getAttribute('data-view')
                    directions={front:[1,0,0],back:[-1,0,0],left:[0,1,0],right:[0,-1,0],top:[0,0,1],bottom:[0,0,-1],iso:[1,-1,1]}
                    direction=new THREE.Vector3(...directions[name]).normalize()
                    up=if name in ['top','bottom'] then new THREE.Vector3(1,0,0) else new THREE.Vector3(0,0,1)
                    App.viewDirection(direction,up)
                    for item in document.querySelectorAll('#view-cube [data-view]')
                        item.setAttribute('aria-pressed',String(item.getAttribute('data-view') is name))
                App.viewerResizeObserver=new ResizeObserver(resizeViewer)
                App.viewerResizeObserver.observe(container)
                window.addEventListener('resize',resizeViewer)
                true

Controlling scene, using dat gui
----------------

        App.viewDirection = (direction, up) ->
                distance=App.camera.position.distanceTo(App.cameraControls.target)
                App.camera.up.copy(up)
                App.camera.position.copy(App.cameraControls.target).addScaledVector(direction,distance)
                App.camera.lookAt(App.cameraControls.target)
                App.cameraControls.update()

        App.fitRobot = ->
                return unless window.robot?
                bounds=new THREE.Box3().setFromObject(window.robot)
                return if bounds.isEmpty()
                size=bounds.getSize(new THREE.Vector3())
                center=bounds.getCenter(new THREE.Vector3())
                span=Math.max(size.x,size.y,size.z,0.01)
                distance=span/(2*Math.tan(App.camera.fov*Math.PI/360))*1.4/Math.min(App.camera.aspect,1)
                direction=App.camera.position.clone().sub(App.cameraControls.target).normalize()
                direction.set(1,1,1).normalize() if direction.lengthSq()<0.01
                App.cameraControls.target.copy(center)
                App.camera.position.copy(center).addScaledVector(direction,distance)
                App.camera.near=Math.max(distance/1000,0.0001)
                App.camera.far=Math.max(distance*100,100)
                App.camera.updateProjectionMatrix()
                App.cameraControls.update()

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

                App.gui = new dat.GUI({autoPlace:false,width:230})
                document.getElementById('joint-controls').replaceChildren(App.gui.domElement)
                App.gui.close() if window.innerWidth<760


Creating gui for robot

                App.robotjointmanipall= new App.RobotJointManipAll({gui:App.gui, joints: window.robotjointcollection});
                App.animform.robotcontroller=App.robotjointmanipall #TODO, this is awkward hack
                App.gui.__folders["Joint values"].open()



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
                App.clock.update()
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


App.animform is an animation controller with different states.

                App.animform.update() if App.animform?
                App.trajectoryview.update()
                true

Starting it all
------------

        $(document).ready(App.init)

        $ ->
                App.router=new App.Router()

                App.animform = new App.AnimationForm({robotcontroller:App.robotjointmanipall});
                App.trajectoryview=new App.TrajectoryView()


                App.usersrobots=new App.AllRobots()
                App.usersrobots.url="/robots"
                App.currentrobot= new App.RobotURDF()
                App.forumula = new App.RobotForm({model:App.currentrobot});
                App.usersrobots.add(App.currentrobot)
                #console.log(window.robot_id)
                unless window.standalone
                    App.currentrobot.id=window.robot_id
                    Backbone.history.start({pushState:true})
                    App.currentrobot.fetch({error: ->
                        App.localRobots.status('Load a local URDF and STL files, or open a robot saved in this browser.')
                    })
                else
                    $.get './testowe/pi_robot_urdf.xml', (data) ->
                        xml=if typeof data is 'string' then data else new XMLSerializer().serializeToString(data)
                        App.localRobots.showURDF(xml)



                #if window.start_with_default
                #    pass
                    #delete App.currentrobot.id



                #$.when($.get("../testowe/pi_robot_urdf.urdf",window.parseRobot)).then( ->
                #        App.setupGui();
                #        App.animate();
                #      )




#        $("body").keydown( event ->
#            if (event.which == 80)
#                takeScreenshot();

#        )
