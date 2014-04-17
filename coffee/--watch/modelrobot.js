// Generated by CoffeeScript 1.7.1
(function() {
  var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  window.App = window.App || {};

  App.el2array = function(el, def, check, delim) {
    var arrayw, el2array;
    if (def == null) {
      def = "0 0 0";
    }
    if (check == null) {
      check = true;
    }
    if (delim == null) {
      delim = " ";
    }
    el2array = (check && el) || def;
    arrayw = el2array.split(delim);
    arrayw = _.map(arrayw, function(num) {
      return num * 1;
    });
    return arrayw;
  };

  App.RobotJoint = (function(_super) {
    __extends(RobotJoint, _super);

    function RobotJoint() {
      this.jointval = __bind(this.jointval, this);
      this.movejoint = __bind(this.movejoint, this);
      this.jointogether = __bind(this.jointogether, this);
      return RobotJoint.__super__.constructor.apply(this, arguments);
    }

    RobotJoint.prototype.initialize = function() {
      var axis, basicMatrix, position, rotation;
      this.theta = 0;
      this.name = this.attributes.name;
      axis = App.el2array(_.has(this.attributes, "axis") && this.attributes.axis.xyz, "1 0 0");
      this.axis = new THREE.Vector3(axis[0], axis[1], axis[2]);
      rotation = App.el2array(_.has(this.attributes, "origin") && this.attributes.origin.rpy, "0 0 0");
      this.basicrotation = new THREE.Vector3(rotation[0], rotation[1], rotation[2]);
      position = App.el2array(_.has(this.attributes, "origin") && this.attributes.origin.xyz, "0 0 0");
      this.basicposition = new THREE.Vector3(position[0], position[1], position[2]);
      this.lower = (_.has(this.attributes, "limit") && this.attributes.limit.lower) || -Math.PI;
      this.upper = (_.has(this.attributes, "limit") && this.attributes.limit.upper) || Math.PI;
      this.lower = this.lower * 1;
      this.upper = this.upper * 1;
      basicMatrix = new THREE.Matrix4();
      this.movementMatrix = new THREE.Matrix4();
      basicMatrix.setRotationFromEuler(this.basicrotation);
      basicMatrix.setPosition(this.basicposition);
      this.basicMatrix = basicMatrix;
      this.currentMatrix = new THREE.Matrix4();
      this.type = this.attributes.type;
      this.on("change:linkcollection", this.jointogether);
      return this;
    };

    RobotJoint.prototype.jointogether = function() {
      var child, parent;
      if (_.has(this.attributes, "parent") && _.has(this.attributes, "child") && _.has(this.attributes, "linkcollection")) {
        child = this.get("linkcollection").get(this.attributes.child.link);
        parent = this.get("linkcollection").get(this.attributes.parent.link);
        this.parentobject3d = parent.get("link");
        this.childobject3d = child.get("link");
        this.parentobject3d.add(this.childobject3d);
        this.childobject3d.matrixAutoUpdate = false;
        return this.childobject3d.matrix = this.basicMatrix;
      }
    };

    RobotJoint.prototype.movejoint = function(t1, t2) {
      var tempMatrix, tempaxis;
      t1 = t1 != null ? t1 : this.theta;
      tempMatrix = new THREE.Matrix4();
      tempaxis = new THREE.Vector3().copy(this.axis);
      if ((this.upper != null) && (this.lower != null)) {
        t1 = Math.max(this.lower, Math.min(t1, this.upper));
      }
      if (this.type === "continuous" || ((this.upper >= t1 && t1 >= this.lower))) {
        switch (this.type) {
          case "revolute":
            this.movementMatrix = tempMatrix.rotateByAxis(this.axis, t1);
            break;
          case "continuous":
            this.movementMatrix = tempMatrix.rotateByAxis(this.axis, t1);
            break;
          case "prismatic":
            this.movementMatrix = tempMatrix.translate(tempaxis.multiplyScalar(t1));
            break;
          case "fixed":
            this.movementMatrix.identity();
            break;
          case "planar":
            this.movementMatrix.identity();
        }
        this.theta = t1;
      } else {
        this.movementMatrix.identity();
        return false;
      }
      this.currentMatrix.multiplyMatrices(this.basicMatrix, this.movementMatrix);
      this.childobject3d.matrix = this.currentMatrix;
      return this;
    };

    RobotJoint.prototype.jointval = function() {
      return this.theta;
    };

    return RobotJoint;

  })(Backbone.Model);

  App.RobotLink = (function(_super) {
    __extends(RobotLink, _super);

    function RobotLink() {
      this.clearthislink = __bind(this.clearthislink, this);
      return RobotLink.__super__.constructor.apply(this, arguments);
    }

    RobotLink.prototype.initialize = function() {
      var link;
      this.robotBaseMaterial = new THREE.MeshPhongMaterial({
        color: 0x6E23BB,
        specular: 0x6E23BB,
        shininess: 10
      });
      this.id = this.get("name");
      this.makeobject3d();
      link = new THREE.Object3D();
      link.name = this.get("name");
      link.add(this.meshvis);
      this.set("link", link);
      return this;
    };

    RobotLink.prototype.makeobject3d = function() {
      var boxsize, color, length, orientation, position, radius;
      if (_.has(this.attributes, "visual")) {
        if (_.has(this.attributes.visual, "material")) {
          color = this.get("materialcollection").get(this.attributes.visual.material.name).get("color");
          this.robotBaseMaterial.color = color;
          this.robotBaseMaterial.specular = color;
          this.robotBaseMaterial.color = color;
        }
        if (_.has(this.attributes.visual.geometry, "box")) {
          boxsize = App.el2array(this.attributes.visual.geometry.box.size, "0 0 0");
          this.makebox(boxsize);
        } else if (_.has(this.attributes.visual.geometry, "cylinder")) {
          length = this.attributes.visual.geometry.cylinder.length || 0;
          radius = this.attributes.visual.geometry.cylinder.radius || 0;
          this.makecylinder(length, radius);
        } else if (_.has(this.attributes.visual.geometry, "sphere")) {
          radius = this.attributes.visual.geometry.sphere.radius || 0;
          this.makesphere(radius);
        } else {
          this.makeempty();
        }
        position = App.el2array(_.has(this.attributes.visual, "origin") && this.attributes.visual.origin.xyz, "0 0 0");
        orientation = App.el2array(_.has(this.attributes.visual, "origin") && this.attributes.visual.origin.rpy, "0 0 0");
        this.meshvis.position.set(position[0], position[1], position[2]);
        this.meshvis.rotation.set(orientation[0], orientation[1], orientation[2]);
        return this;
      } else {
        console.log("there are no visual attributes");
        this.makeempty();
        return this;
      }
    };

    RobotLink.prototype.makecylinder = function(length, radius) {
      var meshvis;
      meshvis = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 500, 1), this.robotBaseMaterial);
      meshvis.rotation = new THREE.Vector3(Math.PI / 2, 0, 0);
      this.meshvis = new THREE.Mesh();
      return this.meshvis.add(meshvis);
    };

    RobotLink.prototype.makebox = function(boxsize) {
      return this.meshvis = new THREE.Mesh(new THREE.CubeGeometry(boxsize[0] * 1, boxsize[1] * 1, boxsize[2] * 1), this.robotBaseMaterial);
    };

    RobotLink.prototype.makesphere = function(radius) {
      return this.meshvis = new THREE.Mesh(new THREE.SphereGeometry(radius, 20, 20), this.robotBaseMaterial);
    };

    RobotLink.prototype.makeempty = function() {
      return this.meshvis = new THREE.Mesh();
    };

    RobotLink.prototype.clearthislink = function() {
      return this.destroy();
    };

    return RobotLink;

  })(Backbone.Model);

  App.RobotMaterial = (function(_super) {
    __extends(RobotMaterial, _super);

    function RobotMaterial() {
      return RobotMaterial.__super__.constructor.apply(this, arguments);
    }

    RobotMaterial.prototype.initialize = function() {
      var check, def, rgba;
      this.id = this.get("name");
      if (_.has(this.attributes, "color")) {
        rgba = App.el2array(_.has(this.attributes.color, "rgba") && this.attributes.color.rgba, def = "0 0 0 1", check = true);
        this.set("color", new THREE.Color().setRGB(rgba[0], rgba[1], rgba[2]));
      }
      return this;
    };

    return RobotMaterial;

  })(Backbone.Model);

  App.RobotMaterialCollection = (function(_super) {
    __extends(RobotMaterialCollection, _super);

    function RobotMaterialCollection() {
      return RobotMaterialCollection.__super__.constructor.apply(this, arguments);
    }

    RobotMaterialCollection.prototype.model = App.RobotMaterial;

    return RobotMaterialCollection;

  })(Backbone.Collection);

  App.RobotLinkCollection = (function(_super) {
    __extends(RobotLinkCollection, _super);

    function RobotLinkCollection() {
      return RobotLinkCollection.__super__.constructor.apply(this, arguments);
    }

    RobotLinkCollection.prototype.model = App.RobotLink;

    return RobotLinkCollection;

  })(Backbone.Collection);

  App.RobotJointCollection = (function(_super) {
    __extends(RobotJointCollection, _super);

    function RobotJointCollection() {
      return RobotJointCollection.__super__.constructor.apply(this, arguments);
    }

    RobotJointCollection.prototype.model = App.RobotJoint;

    return RobotJointCollection;

  })(Backbone.Collection);

  App.RobotJointManipAll = (function(_super) {
    __extends(RobotJointManipAll, _super);

    function RobotJointManipAll() {
      this.jointsval = __bind(this.jointsval, this);
      this.changejointval = __bind(this.changejointval, this);
      this.changepose = __bind(this.changepose, this);
      this.add2gui = __bind(this.add2gui, this);
      return RobotJointManipAll.__super__.constructor.apply(this, arguments);
    }

    RobotJointManipAll.prototype.el = $("#menu");

    RobotJointManipAll.prototype.jointsdict = {};

    RobotJointManipAll.prototype.initialize = function() {
      this.gui = this.options.gui || new dat.GUI();
      this.joints = this.options.joints;
      this.anglesfolder = this.gui.addFolder("Joint values");
      return this.joints.each(this.add2gui);
    };

    RobotJointManipAll.prototype.add2gui = function(joint) {
      return this.jointsdict[joint.get("name")] = new App.RobotJointManipSingle({
        joint: joint,
        gui: this.anglesfolder
      });
    };

    RobotJointManipAll.prototype.changepose = function(posearray, namesarray) {
      var index, name, _i, _len;
      if (posearray.length !== namesarray.length) {
        console.log("pose and namearray have different lengths");
        return false;
      }
      for (index = _i = 0, _len = namesarray.length; _i < _len; index = ++_i) {
        name = namesarray[index];
        this.changejointval(name, posearray[index]);
      }
      return this;
    };

    RobotJointManipAll.prototype.changejointval = function(name, value) {
      this.jointsdict[name].changeval(value, true);
      return this;
    };

    RobotJointManipAll.prototype.jointsval = function(names) {
      var movable, values;
      if (!(names != null) || names === "" || names.length === 0) {
        movable = this.joints.filter(function(joint) {
          return joint.type !== "fixed";
        });
        names = _.pluck(movable, "name");
      }
      values = _.map(names, function(name) {
        return this.jointsdict[name].jointval();
      }, this);
      return [values, names];
    };

    return RobotJointManipAll;

  })(Backbone.View);

  App.RobotJointManipSingle = (function(_super) {
    __extends(RobotJointManipSingle, _super);

    function RobotJointManipSingle() {
      this.jointval = __bind(this.jointval, this);
      this.changeval = __bind(this.changeval, this);
      return RobotJointManipSingle.__super__.constructor.apply(this, arguments);
    }

    RobotJointManipSingle.prototype.initialize = function() {
      this.joint = this.options.joint;
      this.gui = this.options.gui;
      this.dummy = {};
      this.dummy["val"] = 0.01;
      if (this.joint.type !== "fixed") {
        this.controller = this.gui.add(this.dummy, 'val', this.joint.lower, this.joint.upper, 0.01).name(this.joint.get("name"));
        this.dummy["val"] = 0;
        this.controller.updateDisplay();
        return this.controller.onChange(this.changeval);
      }
    };

    RobotJointManipSingle.prototype.changeval = function(value, updateController) {
      if (updateController == null) {
        updateController = false;
      }
      if (this.joint.movejoint(value)) {
        this.dummy["val"] = value;
        if (updateController) {
          this.dummy["val"] = value;
          this.controller.updateDisplay();
        }
      } else {
        console.log(this.joint.get("name") + " not between min max");
      }
      return this;
    };

    RobotJointManipSingle.prototype.jointval = function() {
      var jointv;
      jointv = this.joint.jointval();
      if ((this.dummy["val"] = !jointv)) {
        this.dummy["val"] = jointv;
        this.controller.updateDisplay();
      }
      return jointv;
    };

    return RobotJointManipSingle;

  })(Backbone.View);

  window.clearall = function(scene, robot, jointcollection, modelcollection) {
    scene.remove(robot);
    jointcollection.reset();
    return modelcollection.reset();
  };

  App.RobotForm = (function(_super) {
    __extends(RobotForm, _super);

    function RobotForm() {
      this.sideView = __bind(this.sideView, this);
      this.topView = __bind(this.topView, this);
      this.frontView = __bind(this.frontView, this);
      this.closeScreenshot = __bind(this.closeScreenshot, this);
      this.changeURDFval = __bind(this.changeURDFval, this);
      return RobotForm.__super__.constructor.apply(this, arguments);
    }

    RobotForm.prototype.el = $("#robodiv");

    RobotForm.prototype.events = {
      "click #loadbutton": "resetNload",
      "click #screenshot": "showScreenshot",
      "click #screenshotplace": "closeScreenshot",
      "click #frontview": "frontView",
      "click #topview": "topView",
      "click #sideview": "sideView"
    };

    RobotForm.prototype.initialize = function() {
      return $(".robotlink").on("click", this.changeURDF);
    };

    RobotForm.prototype.resetNload = function() {
      var urdffromform;
      urdffromform = $(this.el).find("#robottext").val();
      window.clearall(window.scene, window.robot, window.robotjointcollection, window.robotlinkcollection);
      window.parseRobot(urdffromform);
      App.setupGui();
      return console.log(urdffromform);
    };

    RobotForm.prototype.changeURDF = function(event) {
      var linkval;
      event.preventDefault();
      linkval = $(this).attr("href");
      $.get(linkval, App.forumula.changeURDFval);
      return true;
    };

    RobotForm.prototype.changeURDFval = function(xmlval) {
      var textval;
      textval = (new XMLSerializer()).serializeToString(xmlval);
      $("#robottext").val(textval);
      return true;
    };

    RobotForm.prototype.showScreenshot = function() {
      var img1;
      App.render();
      img1 = window.renderer.domElement.toDataURL("image/png");
      $("#screenshotplace").html('<img src="' + img1 + '"/>');
      return $("#screenshottext").text("Click image to close");
    };

    RobotForm.prototype.closeScreenshot = function() {
      $("#screenshotplace").html('');
      return $("#screenshottext").text("");
    };

    RobotForm.prototype.frontView = function() {
      console.log(App.camera.position);
      App.camera.position.set(5.12, 0, 0);
      return App.camera;
    };

    RobotForm.prototype.topView = function() {
      App.camera.position.set(0, 0, 5.12);
      return App.camera;
    };

    RobotForm.prototype.sideView = function() {
      App.camera.position.set(0, 5.12, 0);
      return App.camera;
    };

    return RobotForm;

  })(Backbone.View);

  App.Clock = (function(_super) {
    __extends(Clock, _super);

    function Clock(autostart, zeroTime) {
      this.zeroTime = zeroTime;
      if (this.zeroTime == null) {
        this.zeroTime = 0;
      }
      Clock.__super__.constructor.call(this, autostart);
    }

    Clock.prototype.start = function(zerotime) {
      Clock.__super__.start.apply(this, arguments);
      this.zeroTime = zerotime != null ? zerotime : this.zeroTime;
      this.oldTime = this.oldTime - this.zeroTime;
      return this;
    };

    Clock.prototype.stop = function() {
      Clock.__super__.stop.apply(this, arguments);
      return this;
    };

    Clock.prototype.reset = function() {
      this.stop().elapsedTime = 0;
      return this;
    };

    Clock.prototype.set = function(timeinsec) {
      this.zerotime = timeinsec;
      this.elapsedTime = timeinsec;
      return this;
    };

    return Clock;

  })(THREE.Clock);

  App.AnimationForm = (function(_super) {
    __extends(AnimationForm, _super);

    function AnimationForm() {
      this.prevstep = __bind(this.prevstep, this);
      this.nextstep = __bind(this.nextstep, this);
      this.settostaticframe = __bind(this.settostaticframe, this);
      this.update = __bind(this.update, this);
      this.pause = __bind(this.pause, this);
      this.stop = __bind(this.stop, this);
      this.play = __bind(this.play, this);
      this.findframetoshow = __bind(this.findframetoshow, this);
      this.prepareArraysfromCSV = __bind(this.prepareArraysfromCSV, this);
      this.prettify = __bind(this.prettify, this);
      this.loadURDFfromForm = __bind(this.loadURDFfromForm, this);
      return AnimationForm.__super__.constructor.apply(this, arguments);
    }

    AnimationForm.prototype.el = $("#animdiv");

    AnimationForm.prototype.names = [];

    AnimationForm.prototype.poses = [];

    AnimationForm.prototype.times = [];

    AnimationForm.prototype.deltaTime = 0.06;

    AnimationForm.prototype.curframe = 0;

    AnimationForm.prototype.hastimes = false;

    AnimationForm.prototype.initialize = function() {
      this.curtime = new App.Clock(false);
      this.robotcontroller = this.options.robotcontroller;
      this.zerotime = 0;
      this.state = "stopped";
      this.textform = $("#robotcsv");
      this.lh = 18;
      this.line_height_value = "" + this.lh + "px";
      return this.textform.css("line-height", this.line_height_value);
    };

    AnimationForm.prototype.events = {
      "click #loadcsv": "loadURDFfromForm",
      "keydown #robotcsv": "pp",
      "click #playbutton": "playbutton",
      "click #pausebutton": "pausebutton",
      "click #stopbutton": "stopbutton",
      "click #nextbutton": "nextstep",
      "click #prevbutton": "prevstep",
      "click #addposition": "addposition"
    };

    AnimationForm.prototype.addposition = function() {
      var addtime, currentstate;
      currentstate = this.robotcontroller.jointsval(this.names);
      if (this.names.length === 0) {
        this.textform.val("time," + currentstate[1] + "\n" + "0.0," + currentstate[0]);
        this.hastimes = true;
      } else {
        addtime = "";
        if (this.hastimes) {
          addtime += (this.deltaTime + parseFloat(_.last(this.times))) + ",";
        }
        this.textform.val(this.textform.val() + addtime + currentstate[0]);
      }
      return this.loadURDFfromForm();
    };

    AnimationForm.prototype.playbutton = function() {
      if (this.state === "finished") {
        this.stop();
      }
      this.state = "playing";
      this.curtime.start();
      return this.play();
    };

    AnimationForm.prototype.stopbutton = function() {
      this.state = "stopped";
      this.stop();
      return this.robotcontroller.changepose(this.poses[0], this.names);
    };

    AnimationForm.prototype.pausebutton = function() {
      this.state = "paused";
      return this.pause();
    };

    AnimationForm.prototype.pp = function(e) {
      e.stopPropagation();
      return this;
    };

    AnimationForm.prototype.loadURDFfromForm = function() {
      var formcsv;
      formcsv = this.textform.val();
      formcsv = $.trim(formcsv);
      this.prepareArraysfromCSV(formcsv);
      this.textform.val(formcsv + "\n");
      return this;
    };

    AnimationForm.prototype.prettify = function() {
      this.textform.scrollTop(this.lh * (this.curframe + 1));
      if (this.curframe > 0) {
        $("#jointnames").text(this.names + "");
      } else {
        $("#jointnames").text(".");
      }
      return this;
    };

    AnimationForm.prototype.prepareArraysfromCSV = function(csvstring) {
      var allfromcsv, body, head, lastn;
      this.names = [];
      this.poses = [];
      this.times = [];
      allfromcsv = CSVToArray(csvstring);
      if (allfromcsv.length < 2) {
        console.log("It should have at least names and one pose row");
        return false;
      }
      head = allfromcsv[0];
      body = allfromcsv.slice(1);
      this.hastimes = head[0] === "time";
      if (this.hastimes) {
        this.names = _.rest(head);
        body = _.sortBy(body, function(element) {
          return parseFloat(_.first(element));
        });
        _.each(body, function(element) {
          this.times.push(parseFloat(_.first(element)));
          return this.poses.push(_.rest(element));
        }, this);
      } else {
        this.names = head;
        _.each(body, function(element) {
          return this.poses.push(element);
        }, this);
        lastn = this.poses.length;
        this.times = _.range(0, lastn);
        this.times = _.map(this.times, function(time) {
          return time * this.deltaTime;
        }, this);
      }
      return this;
    };

    AnimationForm.prototype.findframetoshow = function(currtime) {
      var frame;
      frame = this.curframe;
      while ((frame <= this.times.length) && (this.times[frame + 1] < currtime)) {
        frame += 1;
      }
      return frame;
    };

    AnimationForm.prototype.play = function() {
      var currtime, pose;
      currtime = this.curtime.getElapsedTime();
      this.curframe = this.findframetoshow(currtime);
      pose = this.poses[this.curframe];
      if (this.curframe >= (this.times.length - 1)) {
        this.state = "finished";
      }
      if (pose !== this.pose) {
        this.robotcontroller.changepose(pose, this.names);
      }
      this.pose = pose;
      this.prettify();
      return this;
    };

    AnimationForm.prototype.stop = function() {
      this.savetime = 0;
      this.curframe = 0;
      this.curtime.reset();
      this.state = "stopped";
      this.prettify();
      return this;
    };

    AnimationForm.prototype.pause = function() {
      this.savetime = this.curtime.getElapsedTime();
      this.curtime.stop();
      this.state = "paused";
      return this;
    };

    AnimationForm.prototype.update = function() {
      if (this.state === "playing") {
        this.play();
      }
      return this;
    };

    AnimationForm.prototype.settostaticframe = function(framenum) {
      var pose;
      pose = this.poses[framenum];
      this.robotcontroller.changepose(pose, this.names);
      this.curframe = framenum;
      this.curtime.set(this.times[framenum]);
      return this;
    };

    AnimationForm.prototype.nextstep = function() {
      var testframe;
      this.state = "stepmode";
      testframe = this.curframe + 1;
      if (testframe >= this.times.length) {

      } else {
        this.settostaticframe(testframe);
      }
      return this.prettify();
    };

    AnimationForm.prototype.prevstep = function() {
      var testframe;
      this.state = "stepmode";
      testframe = this.curframe - 1;
      if (testframe < 0) {

      } else {
        this.settostaticframe(testframe);
      }
      return this.prettify();
    };

    return AnimationForm;

  })(Backbone.View);

  App.notsofast = _.throttle(function(tekkx) {
    console.log(tekkx);
    return true;
  }, 1000);

}).call(this);