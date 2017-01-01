#!/bin/bash
cd coffee
echo "kofiname= Nazwa coffee (bez .coffee)"

read kofiname
# set /P kofiname=Nazwa coffee (bez .litcoffee): %=%
coffee -o ../scripts --watch --compile $kofiname.coffee 
cd ..
