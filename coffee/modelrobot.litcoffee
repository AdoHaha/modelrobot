Main object definitions
=====================
We base whole program on Backbone.js. Each part is a model, as well as joints.


I tried  so that all robot parts ware  in App namespace
        
        window.App = window.App||{};


Helper function, that coverts strings with values delimited by spaces into arrays. There can be default value ( default of default is string with three zeros)
we can have additional info stating whether el value is correct as a third argument (boolean). If it is not correct, function will return array based on default value

        App.el2array= (el,def="0 0 0",check=true,delim=" ")-> #returns array of numbers or default array from string
                el2array=(check&&el)||def
                arrayw=el2array.split(delim)
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
                        axis=App.el2array(_.has(@attributes,"axis")&&@attributes.axis.xyz,"1 0 0");
                               
                        @axis=new THREE.Vector3(axis[0],axis[1],axis[2])
                        rotation=App.el2array(_.has(@attributes,"origin")&&@attributes.origin.rpy,"0 0 0")
                        @basicrotation=new THREE.Euler(rotation[0],rotation[1],rotation[2])
                        position=App.el2array(_.has(@attributes,"origin")&&@attributes.origin.xyz,"0 0 0")
                        @basicposition=new THREE.Vector3(position[0],position[1],position[2])
                
                        @lower=(_.has(@attributes,"limit")&&@attributes.limit.lower)||-Math.PI # could be -Infinity
                        @upper=(_.has(@attributes,"limit")&&@attributes.limit.upper)|| Math.PI #could be Infinity
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

                movejoint: (t1,t2) => #TODO planar type

                        
                        t1=t1 ? @theta

                        tempMatrix=new THREE.Matrix4();
                        tempaxis= new THREE.Vector3().copy(@axis);
                        if (@upper? and @lower?)
                            t1=Math.max(@lower,Math.min(t1,@upper));
                        if (@type=="continuous" or (@upper >= t1 >=@lower)) #check whether movement is allowed
                                switch @type
                                        when "revolute" then @movementMatrix=tempMatrix.makeRotationAxis(@axis,t1)
                                        when "continuous" then @movementMatrix=tempMatrix.makeRotationAxis(@axis,t1)
                                        when "prismatic" then @movementMatrix=tempMatrix.setPosition(tempaxis.multiplyScalar(t1))
                                        when "fixed" then @movementMatrix.identity()
                                        when "planar" then @movementMatrix.identity() #TODO
                                        
                                @theta=t1 #set current state of joint
                        else # if not between upper and lower, do not move, return that movejoint failed
                                @movementMatrix.identity()
                                return false
                        @currentMatrix.multiplyMatrices(@basicMatrix,@movementMatrix)
                        @childobject3d.matrix=@currentMatrix
                
                        @
                jointval: () => #just an interface
                        return @theta         
                        
Helper for implementing true modulo operator

        window.true_mod=(x,m) ->
            return (x%m+m)%m
                        
RobotTrajectory is a class to  that remembers how some particular link of robot moved


        class App.RobotTrajectory extends Backbone.Model
                initialize: (name)->
                    @trajectory=new THREE.Shape()
                    @link_name=@attributes.name
                    @allpoints= new THREE.Geometry(); #this has all point vertices
                    @N=1000
                    for i in [0..@N] by 1
                        @allpoints.vertices.push(new THREE.Vector3(0.0,0.0,1.0))
                    @n=0
                    
                    #@allvertices=[]
                    @throttled_add_to_trajectory=_.throttle(@add_to_trajectory,20) #will add min 50ms aside
                    material = new THREE.LineBasicMaterial({color: 0xff0000,linewidth:3});
                    @line= new THREE.Line(@allpoints,material)
                    #allpoints=[]
                    window.scene.add(@line)
                    return true
                
                new_name: (name)=>
                    @attributes.name=name
                    @link_name=name
                    @clear_trajectory()
                    return true
                add_to_trajectory: =>    
                    try
                        matrix=window.robotlinkcollection.get(@link_name).get("link").matrixWorld.elements  #TODO maybie only once? 
                        #console.log(matrix)     
                        newpoint=new THREE.Vector3(matrix[12],matrix[13],matrix[14])
                        
                                                
Not adding points that are very near

                        len=1000
                        #if(@allvertices.length>0)
                        
                        lastvector=@allpoints.vertices[true_mod(@n-1,@N)]
                        diff=new THREE.Vector3()
                        diff.subVectors(newpoint,lastvector)
                        len=diff.length()
                         
                        if len>0.0001 #when SI this would mean one thenth of mm
                                
                                #@allpoints=new THREE.Geometry()
                                #number=true_mod(@n,@N)
                                if(@n<@N)
                                    @allpoints.vertices[@n]=newpoint
                                    for numbers in [@n..@N] by 1 #this will run only in first N iterations ;)
                                        @allpoints.vertices[numbers]=newpoint
                                else
                                    @allpoints.vertices.shift() #deleting first element
                                    @allpoints.vertices.push(newpoint)
                                @allpoints.verticesNeedUpdate = true;
                                @allpoints.elementsNeedUpdate = true;
                                @n++

                         else
                                return false
                        
                     catch error
                        console.log("couldn't find link:"+name)
                        console.log(error)
                     
                     return false  
                      
                clear_trajectory: =>                      
                    for i in [0..@N] by 1
                        @allpoints.vertices[i].set(0,0,0);
                    @allpoints.verticesNeedUpdate = true;
                    @allpoints.elementsNeedUpdate = true;
                    @n=0      
                                          
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
                      
                                @meshvis.setRotationFromEuler(new THREE.Euler(orientation[0],orientation[1],orientation[2]));
                                console.log(@meshvis.rotation)
                                @
                        
                        else
                                console.log("there are no visual attributes");
                                @makeempty();
                                @
                makecylinder: (length,radius) ->
                        meshvis = new THREE.Mesh( 
                                        new THREE.CylinderGeometry( radius,radius, length,500,1 ), @robotBaseMaterial );
                        
                        meshvis.setRotationFromEuler(new THREE.Euler(Math.PI/2,0.0,0.0,'XYZ'))
                        console.log(meshvis.rotation);
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
       
Controller/view for joints. It also manages the views. To init it has to have an of joints, which it will internally keep as *joints* . Gui elements for each miniview are keept in dict jointsdict

        class App.RobotJointManipAll extends Backbone.View
                el: $("#menu")
                jointsdict:{} #TODO this name is rather bad
        
                initialize: ->
                        #console.log(@options.gui)
                        @gui=@options.gui|| new dat.GUI();
                        @joints=@options.joints
                
                        @anglesfolder=@gui.addFolder("Joint values");
                        @joints.each(@add2gui)
                        
 
                add2gui: (joint) =>
                        @jointsdict[joint.get("name")]= new App.RobotJointManipSingle({joint:joint,gui:@anglesfolder})

The idea behind changepose is: you provide two arrays, and it iterates through using names 

                changepose: (posearray,namesarray) =>
                        if(posearray.length!=namesarray.length)
                                console.log("pose and namearray have different lengths")
                                return false
                        for name, index in namesarray
                                @changejointval(name,posearray[index])
                        
                        @
                                
                changejointval: (name,value) =>
                        @jointsdict[name].changeval(value,true)
                        @
                        
*jointsval* Method that returns values of selected joints as array. When names is empty, it will give values of all joints and all names.
This is so that it can be used to generate CSV of joint poses.
Returns array array[0] joint values array[1] joint names

                jointsval: (names) =>
                        if (!(names?) or names=="" or names.length==0) #empty or not specified
                                movable=@joints.filter( (joint) ->
                                        return joint.type!="fixed"
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
                App.router.navigate("/"+@id)
                      
                                        
                        
                
                
                        
        class App.RobotJointManipSingle extends Backbone.View

                initialize:->
                        #console.log("intialize robotjointmanipsingle");
                        @joint=@options.joint
                        @gui=@options.gui
                        @dummy={}
                        @dummy["val"]=0.01;
                        #console.log(@joint.upper);
                        if(@joint.type!="fixed")
                                @controller=@gui.add(@dummy,'val',@joint.lower,@joint.upper,0.01).name(@joint.get("name"))
                                @dummy["val"]=0
                                @controller.updateDisplay()
                                @controller.onChange(@changeval)
                                
*changeval* is method to control joint from this object, if updateController is false it will just use movejoint method. Otherwise, it will also update the state of slider and state of itself - this is used when this method is accessed from the outside, not from onChange event.
Checks about validity of movement are made inside @joint, we just check whether it succeeded

                changeval: (value,updateController=false) =>
                        #if (@joint.upper >= value >= @joint.lower)
                        
                        if @joint.movejoint(value)
                                
                                @dummy["val"]=value
                                if updateController
                                        @dummy["val"]=value
                                        @controller.updateDisplay()
                                        
                        else
                                console.log(@joint.get("name")+" not between min max") #TODO change it to some pretty alert visable to user
                                              
                        @
                        
*jointval* Giving the current value of joint, using the occasion to set it right when it is not ;)

                jointval: () =>
                        jointv=@joint.jointval()
                        if(@dummy["val"]=!jointv)
                                @dummy["val"]=jointv
                                @controller.updateDisplay()
                        #@controller.updateDisplay()
                        return jointv        
        #                console.log( "new value" + value)

Currently this function just tries to reset all. Robot, jointcollection, modelcollection
It does not change params of scene. TODO: soft reset, that is draw robot from new URDF but change just what changed, not all. Especially don't change pose. 


        window.clearall = (scene,robot,jointcollection,modelcollection) ->
                        scene.remove(robot)
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
                        "click #screenshotplace": "closeScreenshot"
                        "click #frontview":"frontView"
                        "click #topview":"topView"
                        "click #sideview":"sideView"
                        "click #saverobot": "saveRobot"
                        "change #visible": "visible"
                        #"click .robotlink": "changeURDF"
                initialize:->
                    $(".robotlink").on("click", @changeURDF);
                    this.listenTo(this.model, "change", this.newRobot);
                visible: ->
                    @model.set({"visible":$('#visible').prop('checked')})    
                saveRobot: ->
                     #console.log("zapisuje")
                     #event.preventDefault();
                     @resetNload()
                     @model.save()
                newRobot: ->
                    #console.log("robot changed")
                    if window.robotlinkcollection?
                        window.clearall(window.scene,window.robot,window.robotjointcollection,window.robotlinkcollection)

                    if window.parseRobot(@model.attributes.urdf)
                    
                        App.setupGui();
                        App.animate();
                        $("#robottext").val(@model.attributes.urdf)
                        $('#visible').prop('checked', @model.attributes.visible);
                    else
                        window.alert("there was something wrong with your URDF");
                resetNload: ->
                        
                        urdffromform=$(@el).find("#robottext").val()
                        @model.set({urdf:urdffromform})

                        
                changeURDF: (event)->
                    event.preventDefault();
                    linkval=$(this).attr("href")
                  
                    $.get(linkval, App.forumula.changeURDFval) 
                    return true
                    
                changeURDFval: (xmlval)=>
                    textval = (new XMLSerializer()).serializeToString(xmlval);
                    #console.log(xmlval)
                    $("#robottext").val(textval)
                    return true
                     
                showScreenshot: ->
                        App.render();
                        img1 = window.renderer.domElement.toDataURL("image/png");
                        #imgTarget = window.open('', 'For documenting your work');
                        #imgTarget.document.write('<img src="'+img1+'"/>');
                        $( "#screenshotplace" ).html( '<img src="'+img1+'"/>' );
                        $("#screenshottext").text("Click image to close");
                closeScreenshot: =>
                        $( "#screenshotplace" ).html( '' );
                        $("#screenshottext").text("");

                        
Simple camera views, for fast setting
        
                frontView: =>
                        console.log(App.camera.position);
                        App.camera.position.set( 5.12, 0, 0 );
                        
                        return App.camera
                topView: =>
                        App.camera.position.set(0,0,5.12);
                        return App.camera 
                
                sideView: =>
                        App.camera.position.set(0,5.12,0);
                        return App.camera          
                        
                            
Helper clock, I have just added zerotime - to be able to have 

        class App.Clock extends THREE.Clock #just adding zerotime - we can manipulate thing that was called oldtime so that get elapsedTime can be non zero at the beginning
                constructor: (autostart,@zeroTime)->
                        @zeroTime?=0
                        super autostart
                start: (zerotime)->    
                        super #XXX it is running but we still play with it ?
                        @zeroTime =zerotime ? @zeroTime
                        this.oldTime=@oldTime-@zeroTime
                        @
                stop: () -> #I like chaining , btw stop is essentially a pouse?
                        super
                        @
                reset: () -> #because stop just pauses
                        @stop().elapsedTime=0
                        @
                set: (timeinsec) -> #"sets the clock" - 
                        @zerotime=timeinsec
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
                        "click #loadcsv": "loadURDFfromForm"
                        
                        "keydown #robotcsv": "pp"
                        "click #playbutton": "playbutton"
                        "click #pausebutton": "pausebutton"
                        "click #stopbutton": "stopbutton"
                        "click #nextbutton": "nextstep"
                        "click #prevbutton": "prevstep"
                        "click #addposition": "addposition"
                        "click #save": "saverobot"
                saverobot: ->
                        document.getElementById("robotform").submit();
                addposition: -> #it assumes that current csv is loaded
                        currentstate=@robotcontroller.jointsval(@names)
                        if @names.length==0
                                @textform.val("time,"+currentstate[1]+"\n"+"0.0,"+currentstate[0])
                                #there always will be time;
                                @hastimes=true;
                        else
                                addtime=""
                                if @hastimes #there are explicit times
                                        addtime+=(@deltaTime+parseFloat(_.last(@times)))+","
                                        
                                        #sanity check if it is all numbers
                                        
                                @textform.val(@textform.val()+addtime+currentstate[0])
                                #@textform.append("\n"+currentstate[0])
                        @loadURDFfromForm() 
                playbutton:->
                        if @state=="finished"
                                @stop() #rewind
                        
                        @state="playing"
                        @curtime.start()
                        @play()
                stopbutton:->
                        @state="stopped"
                        @stop()
                        @robotcontroller.changepose(@poses[0],@names) #full rewind
                        
                pausebutton:->
                        @state="paused"
                        @pause()
                        
                        
                pp: (e) ->
                        #console.log("eneter")
                        e.stopPropagation()
                        @
                
                loadURDFfromForm: ()=>
                        #console.log("wshoa")
                        formcsv=@textform.val()
                        formcsv=$.trim(formcsv)
                        #console.log(formcsv)
                        @prepareArraysfromCSV(formcsv)
                        @textform.val(formcsv+"\n")
                        @
                prettify: ()=>
                        @textform.scrollTop(@lh*(@curframe+1))
                        if(@curframe>0)
                                $("#jointnames").text(@names+"")
                        else
                                $("#jointnames").text(".")
                        @
                
                        


Helper function that prepares 3 arrays from comma seperated values string. Times can be explicetely stated in first column, if not, it will create array of times with deltaTime timestep

                prepareArraysfromCSV : (csvstring) =>
                        #clear all as this can be users intention
                        @names=[]
                        @poses=[]
                        @times=[]
                        #csvstring=$.trim()
                        allfromcsv=CSVToArray(csvstring) #I use some CSVToArray function found on web
                        
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

