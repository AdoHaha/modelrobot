Parsing URDF to robot model shown on website
====================================
Function in this file prepares robot in App namespace from xml string ( URDF file) 


        window.parseRobot= (xml) ->
                window.scene = window.scene || new THREE.Scene
                if window.robotmaterialcollection?
                    window.robotmaterialcollection.reset()
                else
                    window.robotmaterialcollection=new App.RobotMaterialCollection() ;
                    
                if window.robotlinkcollection?
                    window.robotlinkcollection.reset()
                else
                    window.robotlinkcollection=new App.RobotLinkCollection();
                
                if window.robotjointcollection?
                    window.robotjointcollection.reset()
                else
                    window.robotjointcollection=new App.RobotJointCollection();
                #window.robotlinkcollection=new App.RobotLinkCollection();
                


Using jQery parseXML function, as return we get JQery parsable XML document

                xmelon=$.parseXML(xml); # enabling use of jQuery functions  
                
Setting global robot object, where all parsed parts will be put

                robotBaseMaterial = new THREE.MeshPhongMaterial( { color: 0x6E23BB, specular: 0x6E23BB, shininess: 50 } );
                window.robot=new THREE.Object3D();
                window.robot.name="robot";


Naive parsing into robot object
-------------------------------


First we are putting all colors that robot has, into a collection
               
                $(xmelon).find("color").parent().each( (index) ->
                  
                        robotcolor=new App.RobotMaterial($.xml2json(this));
                        window.robotmaterialcollection.add(robotcolor);
                        true
                  
                        )
                  
We are creating robotlink objects, from their description.
Link is a part as defined in URDF i.e. it is description of a part that is rigid body with such features as intertia, visual etc


Steps to do that:

1. finding adequate parts by jquery
2. translating them from xml to json
3. adding ( hacking ??) to them reference to materialcollection (so that they can access colors)
4. making robotlink object from the json description
5. adding it to collection (robotlinkcollection)
6. adding 3D THREE object to robot

                $(xmelon).find("link").each( (index) ->
                          
                          tjson=$.xml2json(this); #1
                          tjson["materialcollection"]=window.robotmaterialcollection; #2, tODO, seems like a hack
                          robotlink=new App.RobotLink(tjson); #3
                          
                          window.robotlinkcollection.add(robotlink); #4
                          
                         
                            
                          window.robot.add(robotlink.get("link")); #5
                          true      
                        );
                  
Same process as above, this time for all joints
Joints are not added to robot, as they control robot when it is moved, so they influence robot controller and animation


                $(xmelon).find("joint").each( (index) ->
                  
                          robotjoint=new App.RobotJoint($.xml2json(this));
                          robotjoint.set("linkcollection",window.robotlinkcollection);
                          window.robotjointcollection.add(robotjoint);
                  
                        );
                #console.log(scene)
                window.scene.add(window.robot);
                renderer.render(window.scene, App.camera);
                App.trajectoryview.create_list()



