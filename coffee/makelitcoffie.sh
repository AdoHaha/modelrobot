#!/bin/bash
#cd coffee
echo "Making litcoffie and watching, just say what is the file name"

#read kofiname
# set /P kofiname=Nazwa coffee (bez .litcoffee): %=%


file="$1"
#externalprogram "$file" [other parameters]
echo "compiling" $1
coffee -o ../scripts --watch --compile "$file"

