urdf2model = (urdf) ->
#main function that converts urdf syntax to robot model
	urdf
	
class Link	
	name:"fufu"
	@visual
	
	
	
class Visualprop
	geometry:@makegeometry(shape,args)
	
	makegeometry: (shape,args) ->
#function creates shape and puts in right place
		geometry
	
	makebox: (size) ->

#create box, using its size parameters
		box

	makesphere: (radius) ->

		sphere
	
	makecylinder: (radius,lenght) ->
		cylinder
		
class Joint
	type:"fufu"
	name:"costam"
	origin:[1,2,3]
	