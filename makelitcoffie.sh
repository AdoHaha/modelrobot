#!/bin/bash
cd coffee
echo "kofiname= Nazwa coffee (bez .litcoffee)"

read kofiname
# set /P kofiname=Nazwa coffee (bez .litcoffee): %=%
coffee -o ../scripts --watch --compile $kofiname.litcoffee 
cd ..
