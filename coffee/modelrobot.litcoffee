Main object definitions
=====================
We base whole program on Backbone.js. Each part is a model, as well as joints.


I tried  so that all robot parts ware  in App namespace

        window.App = window.App||{};


Helper function, that coverts strings with values delimited by spaces into arrays. There can be default value ( default of default is string with three zeros)
we can have additional info stating whether el value is correct as a third argument (boolean). If it is not correct, function will return array based on default value

        App.el2array= (el,def="0 0 0",check=true,delim=" ")-> #returns array of numbers or default array from string
                el2array=(check&&el)||def
                arrayw=if delim is " " then el2array.trim().split(/\s+/) else el2array.split(delim)
                arrayw=_.map(arrayw,(num)-> num*1)
                return arrayw

Class responsible for changing addresses in browser

        class App.Router extends Backbone.Router

            routes:
                "new_robot": "new_robot"
                ":id": "change_robot"

            change_robot: (id)->
                App.currentrobot.id=id
                App.currentrobot.fetch()
            new_robot: ->
                delete App.currentrobot.id


Model of robot joint, it is responsible of moving links: connecting them together with parent-child relation, as well as moving with controlls/ animation


        class App.RobotJoint extends Backbone.Model


                initialize: ->
                        @theta=0
                        @name=@attributes.name
                        @mimic=@attributes.mimic ? null
                        @mimicChildren=[]
                        axis=App.el2array(_.has(@attributes,"axis")&&@attributes.axis.xyz,"1 0 0");

                        @axis=new THREE.Vector3(axis[0],axis[1],axis[2])
                        @axis.normalize() if @axis.lengthSq()>0
                        rotation=App.el2array(_.has(@attributes,"origin")&&@attributes.origin.rpy,"0 0 0")
                        @basicrotation=new THREE.Euler(rotation[0],rotation[1],rotation[2],'ZYX')
                        position=App.el2array(_.has(@attributes,"origin")&&@attributes.origin.xyz,"0 0 0")
                        @basicposition=new THREE.Vector3(position[0],position[1],position[2])

                        @lower=@attributes.limit?.lower ? -Math.PI
                        @upper=@attributes.limit?.upper ? Math.PI
                        @lower=@lower*1
                        @upper=@upper*1


                        basicMatrix=new THREE.Matrix4()
                        @movementMatrix=new THREE.Matrix4()
                        basicMatrix.makeRotationFromEuler(@basicrotation)
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

Method to change joint theta value and in process move child link. It changes current value or child matrix and upgrades value of this.theta.
t1 - joint value
t2 - will be used when planar joint is implemented
When movement is impossible, return false

                movejoint: (t1,t2,derived=false) => #TODO planar type

                        return false if @mimic? and not derived


                        t1=t1 ? @theta

                        tempMatrix=new THREE.Matrix4();
                        tempaxis= new THREE.Vector3().copy(@axis);
                        if (not derived and @type isnt "continuous" and @upper? and @lower?)
                            t1=Math.max(@lower,Math.min(t1,@upper));
                        withinMimicLimits=(joint,value) ->
                            return false unless Number.isFinite(value)
                            if joint.type isnt "continuous" and (value < joint.lower-1e-12 or value > joint.upper+1e-12)
                                return false
                            for child in joint.mimicChildren
                                return false unless withinMimicLimits(child,value*child.mimicMultiplier+child.mimicOffset)
                            true
                        return false unless withinMimicLimits(@,t1)
                        if (@type=="continuous" or derived or (@upper >= t1 >=@lower)) #check whether movement is allowed
                                switch @type
                                        when "revolute" then @movementMatrix=tempMatrix.makeRotationAxis(@axis,t1)
                                        when "continuous" then @movementMatrix=tempMatrix.makeRotationAxis(@axis,t1)
                                        when "prismatic" then @movementMatrix=tempMatrix.setPosition(tempaxis.multiplyScalar(t1))
                                        when "fixed" then @movementMatrix.identity()
                                        when "planar" then @movementMatrix.identity() #TODO

                                App.collisions?.markDirty() if @theta isnt t1
                                @theta=t1 #set current state of joint
                        else # if not between upper and lower, do not move, return that movejoint failed
                                @movementMatrix.identity()
                                return false
                        @currentMatrix.multiplyMatrices(@basicMatrix,@movementMatrix)
                        @childobject3d.matrix=@currentMatrix
                        child.movejoint(@theta*child.mimicMultiplier+child.mimicOffset,null,true) for child in @mimicChildren

                        @
                jointval: () => #just an interface
                        return @theta

Helper for implementing true modulo operator

        window.true_mod=(x,m) ->
            return (x%m+m)%m

RobotTrajectory is a class to  that remembers how some particular link of robot moved


        class App.RobotTrajectory extends Backbone.Model
                initialize: ->
                    @link_name=@attributes.name
                    @N=1000
                    @points=[]
                    @allpoints=new THREE.BufferGeometry()
                    @allpoints.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(@N*3),3))
                    @allpoints.setDrawRange(0,0)
                    @line=new THREE.Line(@allpoints,new THREE.LineBasicMaterial({color:0xff0000}))
                    @line.frustumCulled=false
                    window.scene.add(@line)
                    @throttled_add_to_trajectory=_.throttle(@add_to_trajectory,20)
                new_name: (name)=>
                    @link_name=name
                    @clear_trajectory()
                add_to_trajectory: =>
                    link=window.robotlinkcollection.get(@link_name)
                    return false unless link?
                    point=link.get('link').getWorldPosition(new THREE.Vector3())
                    return false if @points.length and point.distanceTo(@points[@points.length-1])<0.0001
                    @points.push(point)
                    @points.shift() if @points.length>@N
                    position=@allpoints.getAttribute('position')
                    for item,i in @points
                        position.setXYZ(i,item.x,item.y,item.z)
                    position.needsUpdate=true
                    @allpoints.setDrawRange(0,@points.length)
                    true
                clear_trajectory: =>
                    @points=[]
                    @allpoints.setDrawRange(0,0)

        class App.RobotLink extends Backbone.Model

                initialize: ->
                        @robotBaseMaterial = new THREE.MeshPhongMaterial( { color: 0x6E23BB, specular: 0x6E23BB, shininess: 10 } );
                        @id=@get("name");
                        @meshvis_array=[]
                        @makeobject3d(); #adds link attribute, consisting of created mesh
                        link=new THREE.Object3D();
                        link.name=@get("name")
                        #link.add(@meshvis)
                        link.add mesh for mesh in @meshvis_array
                        @set("link",link)
                        @
                makeobject3d: ->
                        if(_.has(@attributes,"visual"))
                                if(!Array.isArray(@attributes.visual)) #we make sure that visual is an array
                                      @attributes.visual=[@attributes.visual]
                                meshvis_array=[]
                                for visual_element,vis_no in @attributes.visual
                                  robotBaseMaterial=@robotBaseMaterial.clone()

                                  if(_.has(visual_element,"material"))

                                          namedMaterial=@get("materialcollection").get(visual_element.material.name)
                                          color=namedMaterial?.get("color") or robotBaseMaterial.color
                                          robotBaseMaterial.color=color;
                                          robotBaseMaterial.specular=color;
                                          #@robotBaseMaterial.color=color;


                                  if(_.has(visual_element.geometry,"box"))
                                          boxsize=App.el2array(visual_element.geometry.box.size,"0 0 0");
                                          #boxsize=boxsize.split(' ')||[0,0,0];


                                          meshvis=@makebox(boxsize,robotBaseMaterial);
                                  else if(_.has(visual_element.geometry,"cylinder"))
                                          length=visual_element.geometry.cylinder.length||0;
                                          radius=visual_element.geometry.cylinder.radius||0;
                                          meshvis=@makecylinder(length,radius,robotBaseMaterial);
                                  else if(_.has(visual_element.geometry,"sphere"))
                                          radius=visual_element.geometry.sphere.radius||0;
                                          meshvis=@makesphere(radius,robotBaseMaterial);
                                  else if(_.has(visual_element.geometry,"mesh"))
                                          meshvis=App.localRobots.mesh(visual_element.geometry.mesh,robotBaseMaterial)
                                  else
                                          meshvis=@makeempty();

                                  position=App.el2array(_.has(visual_element,"origin")&&visual_element.origin.xyz,"0 0 0")

                                  orientation=App.el2array(_.has(visual_element,"origin")&&visual_element.origin.rpy,"0 0 0")
                                  meshvis.position.set(position[0], position[1],position[2]);

                                  meshvis.setRotationFromEuler(new THREE.Euler(orientation[0],orientation[1],orientation[2],'ZYX'));
                                  #console.log(@meshvis.rotation)
                                  meshvis_array.push(meshvis)

                        else
                                console.log("there are no visual attributes");
                                meshvis=@makeempty();
                                meshvis_array=[meshvis]
                        @meshvis_array=meshvis_array
                        @

                makecylinder: (length,radius,material) ->
                        meshvis = new THREE.Mesh(
                                        new THREE.CylinderGeometry( radius,radius, length,500,1 ), material );

                        meshvis.setRotationFromEuler(new THREE.Euler(Math.PI/2,0.0,0.0,'XYZ'))
                        #console.log(meshvis.rotation);
                        meshvis_parent=new THREE.Object3D()
                        meshvis_parent.add(meshvis)
                        return meshvis_parent
                makebox: (boxsize,material) ->
                        meshvis = new THREE.Mesh(
                                        new THREE.BoxGeometry( boxsize[0]*1,boxsize[1]*1, boxsize[2]*1 ), material );
                        return meshvis
                makesphere: (radius,material) ->
                        meshvis = new THREE.Mesh(
                                        new THREE.SphereGeometry( radius,20,20 ), material );
                        return meshvis
                makeempty: ->
                        meshvis = new THREE.Object3D();
                        return meshvis
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

Controller/view for joints. It also manages the views. To init it has to have an of joints, which it will internally keep as *joints* . Gui elements for each miniview are keept in dict jointsdict

        class App.RobotJointManipAll extends Backbone.View
                el: $("#menu")
                jointsdict:{} #TODO this name is rather bad

                initialize: ->
                        #console.log(@options.gui)
                        @gui=@options.gui|| new dat.GUI();
                        @joints=@options.joints
                        @jointsdict={}

                        @anglesfolder=@gui.addFolder("Joint values");
                        App.i18n.setText(@anglesfolder.domElement.querySelector('.title'),"Joint values")
                        @add2gui = @add2gui.bind(@)
                        @joints.each((joint) => @add2gui(joint))

                add2gui: (joint) ->
                        return if joint.type is "fixed" or joint.mimic?
                        @jointsdict[joint.get("name")]= new App.RobotJointManipSingle({joint:joint,gui:@anglesfolder})

The idea behind changepose is: you provide two arrays, and it iterates through using names

                changepose: (posearray,namesarray) ->
                        if(posearray.length!=namesarray.length)
                                console.log("pose and namearray have different lengths")
                                return false
                        for name, index in namesarray
                                @changejointval(name,posearray[index])

                        @

                changejointval: (name,value) ->
                        @jointsdict[name]?.changeval(value,true)
                        @

*jointsval* Method that returns values of selected joints as array. When names is empty, it will give values of all joints and all names.
This is so that it can be used to generate CSV of joint poses.
Returns array array[0] joint values array[1] joint names

                jointsval: (names) ->
                        if (!(names?) or names=="" or names.length==0) #empty or not specified
                                movable=@joints.filter( (joint) ->
                                        return joint.type!="fixed" and not joint.mimic?
                                )
                                names=_.pluck(movable,"name")
                                #names=_.map(@jointsdict,(value,key) ->
                                #        return key
                                #, @)

                        values=_.map(names, (name) ->
                                @jointsdict[name].jointval()
                        , @)

                        return [values,names]



        class App.AllRobots extends Backbone.Collection
            model:App.RobotURDF



        class App.AllCSVs extends Backbone.Collection

RobotURDF is a true Backbone Model, communicating with App Engine Server
There can be only one such model on scene ###TODO this seems fundamentaly wrong

        class App.RobotURDF extends Backbone.Model
            initialize:->

                @on("change",@change_address)
                return true
            change_address:->
                App.router.navigate("/"+@id) unless window.standalone






        class App.RobotJointManipSingle extends Backbone.View

                initialize:->
                        #console.log("intialize robotjointmanipsingle");
                        @changeval = @changeval.bind(@)
                        @jointval = @jointval.bind(@)
                        @joint=@options.joint
                        @gui=@options.gui
                        @dummy={}
                        @dummy["val"]=0.01;
                        #console.log(@joint.upper);
                        if(@joint.type!="fixed")
                                @controller=@gui.add(@dummy,'val',@joint.lower,@joint.upper,0.01).name(@joint.get("name"))
                                @dummy["val"]=@joint.theta
                                @controller.updateDisplay()
                                @controller.onChange(@changeval)
                                App.workspace.connectJointSlider(@controller,@joint)

*changeval* is method to control joint from this object, if updateController is false it will just use movejoint method. Otherwise, it will also update the state of slider and state of itself - this is used when this method is accessed from the outside, not from onChange event.
Checks about validity of movement are made inside @joint, we just check whether it succeeded

                changeval: (value,updateController=false) ->
                        App.poseTool?.finish()
                        #if (@joint.upper >= value >= @joint.lower)

                        if @joint.movejoint(value)

                                @dummy["val"]=@joint.theta
                                @controller.updateDisplay()

                        else
                                @dummy["val"]=@joint.theta
                                @controller.updateDisplay()
                                console.log(@joint.get("name")+" not between min max") #TODO change it to some pretty alert visable to user

                        @

*jointval* Giving the current value of joint, using the occasion to set it right when it is not ;)

                jointval: () ->
                        jointv=@joint.jointval()
                        if @dummy["val"] isnt jointv
                                @dummy["val"]=jointv
                                @controller.updateDisplay()
                        #@controller.updateDisplay()
                        return jointv
        #                console.log( "new value" + value)

Currently this function just tries to reset all. Robot, jointcollection, modelcollection
It does not change params of scene. TODO: soft reset, that is draw robot from new URDF but change just what changed, not all. Especially don't change pose.


        window.clearall = (scene,robot,jointcollection,modelcollection) ->
                        scene.remove(robot)
                        robot?.traverse (object) ->
                            object.geometry?.dispose()
                            if object.material?
                                object.material.dispose()
                        #jointcollection.each( (joint) -> joint.destroy())
                        jointcollection.reset()
                        #modelcollection.each( (link) -> link.destroy())

                        modelcollection.reset()



Functions connected to top form, where URDF is placed. TODO: it schouldn't reset all if not asked, just update. This will make it more interactive.

        class App.RobotForm extends Backbone.View
                el: $("#controldiv")
                events:
                        "click #loadbutton": "resetNload"
                        "click #screenshot": "showScreenshot"
                        "drop #robottextbox": "URDFfiledrop"
                        "drag #robottextbox": "URDFfiledrag"
                        "click #screenshotplace": "closeScreenshot"
                        "click #frontview":"frontView"
                        "click #topview":"topView"
                        "click #sideview":"sideView"
                        "click #fitview": "fitView"
                        "click #saverobot": "saveRobot"
                        "click #armode": "arMode"
                        "change #visible": "visible"
                        #"click .robotlink": "changeURDF"
                initialize:->
                    $(".robotlink").on("click", @changeURDF);
                    this.listenTo(this.model, "change", this.newRobot);
                    this.myCodeMirror = CodeMirror.fromTextArea($("#robottext")[0], {
                          mode: "application/xml",
                          lineNumbers: true,
                          lineWrapping: true,
                          indentUnit: 2,
                          extraKeys: {"Ctrl-Enter": (=> @resetNload()), "Cmd-Enter": (=> @resetNload())},
                          theme: "default"
                          });
                    App.workspace.init(@)
                    App.localRobots.init(@)

                URDFfiledrag: (evt)=>
                        evt.stopPropagation();
                        evt.preventDefault();
                        evt.originalEvent.dataTransfer.dropEffect = 'copy'; # Explicitly show this is a copy.
                URDFfiledrop: (evt)=>
                        evt.stopPropagation()
                        evt.preventDefault()
                        App.localRobots.importFiles({files:evt.originalEvent.dataTransfer.files,value:''}).catch (error) ->
                            App.localRobots.status(error.message,true)
                visible: ->
                    @model.set({"visible":$('#visible').prop('checked')})
                saveRobot: ->

                     @resetNload()
                     @model.save()
                arMode: ->
                    pageid=App.currentrobot.id;
                    qrcode = new QRCode(document.getElementById("qrcode"), {
                                        text: "https://mymodelrobot.appspot.com/ar/"+pageid,
                                        width: 128,
                                        height: 128,
                                        colorDark : "#000000",
                                        colorLight : "#ffffff",
                                        correctLevel : QRCode.CorrectLevel.H
                                });
                    window.open("https://mymodelrobot.appspot.com/ar/"+pageid,"_blank");
                newRobot: ->
                    try
                        App.localRobots.validate(@model.attributes.urdf)
                    catch error
                        App.localRobots.status(error.message,true)
                        return false
                    App.poseTool.finish(true)
                    opening=App.localRobots.openingDocument or not window.robot?
                    poses={}
                    unless opening
                        window.robotjointcollection.each (joint) -> poses[joint.name]=joint.theta unless joint.mimic?
                    editorCursor=@myCodeMirror.getCursor()
                    editorScroll=@myCodeMirror.getScrollInfo()
                    App.animform.stop()
                    App.localRobots.messages=[]
                    App.collisions.clear()
                    if window.robotlinkcollection?
                        window.clearall(window.scene,window.robot,window.robotjointcollection,window.robotlinkcollection)

                    if window.parseRobot(@model.attributes.urdf)

                        App.setupGui();
                        if opening
                            App.fitRobot()
                        else
                            window.robotjointcollection.each (joint) -> joint.movejoint(poses[joint.name]) if poses[joint.name]? and not joint.mimic?
                            App.robotjointmanipall.jointsval()
                        collisionIssues=App.collisions.rebuild(@model.attributes.urdf,window.robotlinkcollection,window.robotjointcollection)
                        App.localRobots.messages.push(issue) for issue in collisionIssues
                        App.collisions.update(performance.now(),true)
                        App.localRobots.openingDocument=false
                        unless App.animationStarted
                            App.animationStarted=true
                            App.animate()
                        #$("#robottext").val(@model.attributes.urdf)
                        if @myCodeMirror.getValue() isnt @model.attributes.urdf
                            @myCodeMirror.setValue(@model.attributes.urdf)
                        unless opening
                            @myCodeMirror.setCursor(editorCursor)
                            @myCodeMirror.scrollTo(editorScroll.left,editorScroll.top)
                        @myCodeMirror.save()
                        $('#visible').prop('checked', @model.attributes.visible);
                        App.localRobots.loaded(@model.attributes.urdf)
                        if App.workspace.animationStatus()
                            App.animform.prepareArraysfromCSV($('#robotcsv').val())
                    else
                        window.alert(App.i18n.t("there was something wrong with your URDF"));
                resetNload: ->
                        @myCodeMirror.save() #this pushes the codemirror code to textarea (robottext)
                        urdffromform=$(@el).find("#robottext").val()
                        if @model.get('urdf') is urdffromform
                            @newRobot()
                        else
                            @model.set({urdf:urdffromform})


                changeURDF: (event)->
                    event.preventDefault();
                    linkval=$(this).attr("href")

                    $.get(linkval, App.forumula.changeURDFval)
                    return true

                changeURDFval: (xmlval)=>
                    textval = (new XMLSerializer()).serializeToString(xmlval);
                    #console.log(xmlval)
                    @myCodeMirror.setValue(textval)
                    @myCodeMirror.save()
                    #$("#robottext").val(textval)
                    return true

                showScreenshot: ->
                        App.render();
                        img1 = window.renderer.domElement.toDataURL("image/png");
                        #imgTarget = window.open('', 'For documenting your work');
                        #imgTarget.document.write('<img src="'+img1+'"/>');
                        $( "#screenshotplace" ).html( '<img src="'+img1+'"/>' );
                        App.i18n.setText(document.getElementById('screenshottext'),"Click image to close")
                closeScreenshot: =>
                        $( "#screenshotplace" ).html( '' );
                        App.i18n.setText(document.getElementById('screenshottext'),"")


Simple camera views, for fast setting

                fitView: -> App.fitRobot()

                frontView: => App.viewDirection(new THREE.Vector3(1,0,0),new THREE.Vector3(0,0,1))
                topView: => App.viewDirection(new THREE.Vector3(0,0,1),new THREE.Vector3(1,0,0))
                sideView: => App.viewDirection(new THREE.Vector3(0,1,0),new THREE.Vector3(0,0,1))


Helper clock, I have just added zerotime - to be able to have

        class App.Clock
                constructor: (@autoStart=true, zeroTime=0) ->
                        @timer=new THREE.Timer()
                        @elapsedTime=zeroTime
                        @running=false
                start: (zeroTime) ->
                        @elapsedTime=zeroTime if zeroTime?
                        @timer.reset()
                        @running=true
                        @
                getDelta: ->
                        @start() if @autoStart and not @running
                        @timer.update()
                        delta=if @running then @timer.getDelta() else 0
                        @elapsedTime+=delta
                        delta
                getElapsedTime: ->
                        @getDelta()
                        @elapsedTime
                stop: ->
                        @getElapsedTime()
                        @running=false
                        @autoStart=false
                        @
                reset: ->
                        @stop()
                        @elapsedTime=0
                        @
                set: (timeinsec) ->
                        @stop()
                        @elapsedTime=timeinsec
                        @


This watches over trajectory generation

        class App.TrajectoryView extends Backbone.View
                el: $("#trajectory")
                initialize:->
                    @tracing=false
                    @robot_trajectory=new App.RobotTrajectory("Nothing")
                    #@create_list()

                create_list:->
                            $("#all_links").empty()
                            window.robotlinkcollection.each( (link)->
                                 linkname=link.get("name")
                                 $("#all_links").append( new Option(linkname,linkname) );
                                 #console.log(linkname)
                            )
                            @tracing=false
                            $("#tracebutton").removeClass("btn-danger").addClass("btn-success")
                            @clear
                            return true
                events:
                    "click #tracebutton": "trace"
                    "click #clear_trajectory": "clear"
                clear:->
                    console.log("clearing")
                    @robot_trajectory.clear_trajectory()

                trace:->
                    console.log("tracing")
                    if not @tracing
                        #name=$("#link_name_form").val()
                        name=$( "#all_links").val()
                        if name? and name isnt ""
                            @robot_trajectory.new_name(name)
                            @tracing=true
                            $("#tracebutton").removeClass("btn-success").addClass("btn-danger")


                    else
                        @tracing=false
                        $("#tracebutton").removeClass("btn-danger").addClass("btn-success")
                    return true
                update:->
                    #@robot_trajectory.add_to_trajectory()
                    if(@tracing)

                        @robot_trajectory.throttled_add_to_trajectory()
                    return true

AnimationForm class will control robot animation, from the form submission, in different modes
* play: plays through poses set in @poses with points in time set in @times array
* pause: stops playing
* stop: stops and resets
* step: goes through @poses

        class App.AnimationForm extends Backbone.View
                el: $("#animdiv")
                names:[]
                poses:[]
                times:[]
                deltaTime:0.06
                curframe:0
                hastimes:false

                initialize:->
                        #console.log("intialize robotjointmanipsingle");
                        @curtime=new App.Clock(false) # init timer without autostart

                        @robotcontroller=@options.robotcontroller
                        @zerotime=0 # it will be used when pousing, stepping
                        @state="stopped"
                        @textform=$("#robotcsv")
                        @lh=18
                        @line_height_value=""+@lh+"px"
                        @textform.css("line-height",@line_height_value)
                events:
                        "click #loadcsv": "loadCSVfromForm"
                        "drop #robotcsv": "CSVfiledrop"
                        "drag #robotcsv": "CSVfiledrag"
                        "keydown #robotcsv": "pp"
                        "click #playbutton": "playbutton"
                        "click #pausebutton": "pausebutton"
                        "click #stopbutton": "stopbutton"
                        "click #nextbutton": "nextstep"
                        "click #prevbutton": "prevstep"
                        "click #addposition": "addposition"
                        "click #save": "saverobot"
                CSVfiledrag: (evt)=>
                        evt.stopPropagation();
                        evt.preventDefault();
                        evt.originalEvent.dataTransfer.dropEffect = 'copy'; # Explicitly show this is a copy.
                CSVfiledrop: (evt)=>
                        window.evt=evt
                        console.log(evt)
                        evt.stopPropagation();
                        evt.preventDefault();
                        files = evt.originalEvent.dataTransfer.files; # FileList object.

                        #// files is a FileList of File objects. List some properties.
                        output = [];
                        reader = new FileReader();


                        reader.onload= (event) =>
                                            $("#robotcsv").val(event.target.result)
                                            this.loadCSVfromForm()
                        for f in files
                            reader.readAsText(f);

                saverobot: ->
                        document.getElementById("robotform").submit();
                addposition: ->
                        App.workspace.appendCurrentPose()
                playbutton:->
                        return unless App.workspace.animationStatus()
                        @prepareArraysfromCSV(@textform.val())
                        if @state=="finished"
                                @stop() #rewind

                        @state="playing"
                        @curtime.start()
                        @play()
                stopbutton:->
                        @state="stopped"
                        @stop()
                        @robotcontroller.changepose(@poses[0],@names) if @poses.length #full rewind

                pausebutton:->
                        @state="paused"
                        @pause()


                pp: (e) ->
                        #console.log("eneter")
                        e.stopPropagation()
                        @

                loadCSVfromForm: (options)=>
                        @stop()
                        unless App.workspace.animationStatus()
                            App.localRobots.saveAnimation()
                            return @
                        console.log("loading csv")
                        formcsv=@textform.val()
                        formcsv=$.trim(formcsv)
                        #console.log(formcsv)
                        @prepareArraysfromCSV(formcsv)
                        @textform.val(formcsv+"\n") unless options?.preserveText is true
                        App.localRobots.saveAnimation()
                        App.workspace.animationStatus()
                        @
                prettify: ()=>
                        @textform.scrollTop(@lh*(@curframe+1))
                        App.i18n.setText(document.getElementById('jointnames'),"Frame {frame} / {count}",{frame:@curframe+1,count:@poses.length}) if @poses.length
                        @




Helper function that prepares 3 arrays from comma seperated values string. Times can be explicetely stated in first column, if not, it will create array of times with deltaTime timestep

                prepareArraysfromCSV : (csvstring) =>
                        #clear all as this can be users intention
                        @names=[]
                        @poses=[]
                        @times=[]
                        #csvstring=$.trim()
                        allfromcsv=CSVToArray($.trim(csvstring)) #I use some CSVToArray function found on web

                        #console.log(allfromcsv)
                        if allfromcsv.length<2
                                console.log("It should have at least names and one pose row")
                                return false

                        #from here, we devide in 3 arrays: names, times, poses
                        head=allfromcsv[0]
                        body=allfromcsv[1..]
                        @hastimes=head[0]=="time"
                        #console.log(hastimes)
                        if @hastimes #there is explicitely set array of times

                                @names=_.rest(head)

                                body=_.sortBy(body, (element) ->
                                        return parseFloat(_.first(element))
                                        )

                                 #making sure times are growing (sortinig)
                                _.each(body, (element) ->
                                        @times.push(parseFloat(_.first(element)))
                                        @poses.push(_.rest(element))

                                       ,@)
                        else
                                @names=head

                                _.each(body,(element) ->
                                        @poses.push(element)
                                ,@)
                                lastn=(@poses.length)
                                @times=_.range(0,lastn) #range sucks with floating point

                                @times=_.map(@times, (time) ->
                                        time*@deltaTime
                                 ,@) #to step each DetltaTime

                        return @
                findframetoshow: (currtime) => #we assume that frames are sorted by time (it is done in prepareArraysFromCSV)
                        frame=@curframe
                        while ( ((frame)<=@times.length) && (@times[frame+1]<currtime)       )
                                frame+=1

                        #thinking whether to change @currframe here
                        return frame
                 play: =>
                        #if @curtime.running
                        currtime=@curtime.getElapsedTime()

                        #console.log(currtime)
                        @curframe=@findframetoshow(currtime)
                        #App.notsofast(@curframe)
                        #console.log(@currframe)
                        pose=@poses[@curframe]
                        #console.log(pose)
                        if(@curframe>=(@times.length-1)) #shouldn't ever be bigger
                                #console.log("fin")
                                #@stop()
                                @state="finished"

                        if(pose!=@pose) #don't calculate when there is no need

                            @robotcontroller.changepose(pose,@names)

                        #console.log(pose)
                        #else:
                        #    console.log("same")

                        @pose=pose
                        @prettify()
                        @
                 stop: =>
                        @savetime=0 #it will restart with curtime =0
                        @curframe=0 #rewind
                        @curtime.reset()
                        @state="stopped"
                        @prettify()
                        @
                 pause: =>
                        @savetime=@curtime.getElapsedTime() #it will restart with curtime =savetime
                        @curtime.stop()
                        @state="paused"
                        @
                 update: () => #this will be updated at each render frame (it has to be put at render)

                        if(@state=="playing")
                                #App.notsofast("updating")
                                @play()
                        @
                 settostaticframe : (framenum) =>
                         pose=@poses[framenum]
                         @robotcontroller.changepose(pose,@names)
                         @curframe=framenum
                         @curtime.set(@times[framenum])
                         @
                 nextstep : =>
                        @state="stepmode"
                        testframe=@curframe+1
                        if(testframe>=(@times.length))
                        #last one was last ;)
                        else
                                @settostaticframe(testframe)
                        @prettify()
                 prevstep : =>
                        @state="stepmode"
                        testframe=@curframe-1
                        if ( testframe < 0 )
                                #we have come to beginning TODO maybie rewind?
                        else
                               @settostaticframe(testframe)
                        @prettify()

Just a small helper to show what is with animation

        App.notsofast = _.throttle( (tekkx)->
                                console.log(tekkx)
                                return true
                     ,1000)
        #App.notsofast("fufu")
