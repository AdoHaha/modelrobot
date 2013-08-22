We will be setting functions to animate the robot

        App.prepareArrayfromCSV = (csvstring) ->
                # parseCSV: function(delimiter, qualifier, escape, lineDelimiter)
                resArray=CSVToArray(csvstring," ")
                console.log(resArray)
                resArray
        
        App.prepareArrayfromCSV("1 2 3 4 5 \n
3 4 5 6 7 \n
e f e m b z d")
                
                
   
