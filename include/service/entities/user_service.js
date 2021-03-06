/*
    Copyright (C) 2015  PencilBlue, LLC

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

//dependencies
var async = require('async');
var util  = require('../../util.js');

module.exports = function UserServiceModule(pb) {

    /**
     * Service for performing user specific operations.
     *
     * @module Services
     * @submodule Entities
     * @class UserService
     * @constructor
     */
    function UserService(){}

    /**
     * Gets the full name of a user
     *
     * @method getFullName
     * @param {String}   userId The object Id of the user
     * @param {Function} cb     Callback function
     */
    UserService.prototype.getFullName = function(userId, cb) {
        if (!pb.validation.isId(userId, true)) {
            return cb(new Error('The userId parameter must be a valid ID value'));
        }

        var self = this;
        var dao  = new pb.DAO();
        dao.loadById(userId, 'user', function(err, author){
            if (util.isError(err)) {
                return callback(err, null);
            }

            cb(null, self.getFormattedName(author));
        });
    };

    /**
     * Takes the specified user object and formats the first and last name.
     * @static
     * @method getFormattedName
     * @param {Object} user The user object to extract a name for.
     * @return {String} The user's full name
     */
    UserService.prototype.getFormattedName = function(user) {
        var name = user.username;
        if (user.first_name) {
            name = user.first_name + ' ' + user.last_name;
        }
        return name;
    };

    /**
     * Gets the full names for the supplied authors
     *
     * @method getAuthors
     * @param {Array}   objArry An array of user object
     * @param {Function} cb     Callback function
     */
    UserService.prototype.getAuthors = function(objArry, cb){
        var self  = this;

        //retrieve unique author list
        var authorIds = {};
        for (var i = 0; i < objArry.length; i++) {
            authorIds[objArry[i].author] = true;
        }

        //retrieve authors
        var opts = {
            select: {
                username: 1,
                first_name: 1,
                last_name: 1
            },
            where: pb.DAO.getIdInWhere(Object.keys(authorIds))
        };
        var dao = new pb.DAO();
        dao.q('user', opts, function(err, authors) {
            if (util.isError(err)) {
                return cb(err);
            }

            //convert results into searchable hash
            var authLookup = util.arrayToObj(authors, function(authors, i) { return authors[i][pb.DAO.getIdField()].toString(); });

            //set the full name of the author
            for (var i = 0; i < objArry.length; i++) {
                objArry[i].author_name = self.getFormattedName(authLookup[objArry[i].author]);
            }

            //callback with objects (not necessary but we do it anyway)
            cb(null, objArry);
        });
    };

    /**
     * Retrieves the available access privileges to assign to a user
     *
     * @method getAdminOptions
     * @param {Object} session The current session object
     * @param {Object} ls      The localization object
     */
    UserService.prototype.getAdminOptions = function(session, ls) {
        var adminOptions = [
            {name: ls.get('READER'), value: pb.SecurityService.ACCESS_USER},
            {name: ls.get('WRITER'), value: pb.SecurityService.ACCESS_WRITER},
            {name: ls.get('EDITOR'), value: pb.SecurityService.ACCESS_EDITOR}
        ];

        if(session.authentication.user.admin >= pb.SecurityService.ACCESS_MANAGING_EDITOR) {
            adminOptions.push({name: ls.get('MANAGING_EDITOR'), value: pb.SecurityService.ACCESS_MANAGING_EDITOR});
        }
        if(session.authentication.user.admin >= pb.SecurityService.ACCESS_ADMINISTRATOR) {
            adminOptions.push({name: ls.get('ADMINISTRATOR'), value: pb.SecurityService.ACCESS_ADMINISTRATOR});
        }

        return adminOptions;
    };
    
    /**
     * Retrieves a select list (id/name) of available system editors
     * @deprecated since 0.4.0
     * @method getEditorSelectList
     * @param {String} currId The Id to be excluded from the list.
     * @param {Function} cb A callback that takes two parameters.  The first is an
     * error, if exists, the second is an array of objects that represent the
     * editor select list.
     */
    UserService.prototype.getEditorSelectList = function(currId, cb) {
        pb.log.warn('UserService: getEditorSelectList is deprecated. Use getWriterOrEditorSelectList instead');
        this.getWriterOrEditorSelectList(currId, cb);
    };

    /**
     * Retrieves a select list (id/name) of available system writers or editors
     * @method getWriterOrEditorSelectList
     * @param {String} currId The Id to be excluded from the list.
     * @param {Boolean} [getWriters=false] Whether to retrieve all writers or just editors.
     * @param {Function} cb A callback that takes two parameters.  The first is an
     * error, if exists, the second is an array of objects that represent the
     * editor select list.
     */
    UserService.prototype.getWriterOrEditorSelectList = function(currId, getWriters, cb) {
        if (util.isFunction(getWriters)) {
            cb = getWriters;
            getWriters = false;
        }
        
        var self = this;

        var opts = {
            select: {
                first_name: 1,
                last_name: 1
            },
            where: {
                admin: {
                    $gte: getWriters ? pb.SecurityService.ACCESS_WRITER : pb.SecurityService.ACCESS_EDITOR
                }
            }
        };
        var dao = new pb.DAO();
        dao.q('user', opts, function(err, data){
            if (util.isError(err)) {
                return cb(err, null);
            }

            var editors = [];
            for(var i = 0; i < data.length; i++) {

                var editor = {
                    name: self.getFormattedName(data[i])
                };
                editor[pb.DAO.getIdField()] = data[i][pb.DAO.getIdField()];

                if(currId == data[i][pb.DAO.getIdField()].toString()) {
                    editor.selected = 'selected';
                }
                editors.push(editor);
            }
            cb(null, editors);
        });
    };

    /**
     * Sends a verification email to an unverified user
     *
     * @method sendVerificationEmail
     * @param {Object}   user A user object
     * @param {Function} cb   Callback function
     */
    UserService.prototype.sendVerificationEmail = function(user, cb) {
        cb = cb || util.cb;

        // We need to see if email settings have been saved with verification content
        var emailService = new pb.EmailService();
        emailService.getSettings(function(err, emailSettings) {
            var options = {
                to: user.email,
                replacements: {
                    'verification_url': pb.config.siteRoot + '/actions/user/verify_email?email=' + user.email + '&code=' + user.verification_code,
                    'first_name': user.first_name,
                    'last_name': user.last_name
                }
            };
            if(emailSettings.layout) {
                options.subject= emailSettings.verification_subject;
                options.layout = emailSettings.verification_content;
                emailService.sendFromLayout(options, cb);
            }
            else {
                options.subject = pb.config.siteName + ' Account Confirmation';
                options.template = emailSettings.template;
                emailService.sendFromTemplate(options, cb);
            }
        });
    };

    /**
     * Sends a password reset email to a user
     *
     * @method sendPasswordResetEmail
     * @param {Object}   user          A user object
     * @param {Object}   passwordReset A password reset object containing the verification code
     * @param {Function} cb            Callback function
     */
    UserService.prototype.sendPasswordResetEmail = function(user, passwordReset, cb) {
        cb = cb || util.cb;

        var verficationUrl = pb.UrlService.urlJoin(pb.config.siteRoot, '/actions/user/reset_password') + util.format('?email=%s&code=%s', encodeURIComponent(user.email), encodeURIComponent(passwordReset.verification_code));
        var options = {
            to: user.email,
            subject: pb.config.siteName + ' Password Reset',
            template: 'admin/elements/password_reset_email',
            replacements: {
                'verification_url': verficationUrl,
                'first_name': user.first_name,
                'last_name': user.last_name
            }
        };
        var emailService = new pb.EmailService();
        emailService.sendFromTemplate(options, cb);
    };

    /**
     * Checks to see if a proposed user name or email is already in the system
     *
     * @method isUserNameOrEmailTaken
     * @param {String}   username
     * @param {String}   email
     * @param {String}   id       User object Id to exclude from the search
     * @param {Function} cb       Callback function
     */
    UserService.prototype.isUserNameOrEmailTaken = function(username, email, id, cb) {
        this.getExistingUsernameEmailCounts(username, email, id, function(err, results) {

            var result = results === null;
            if (!result) {

                for(var key in results) {
                    result |= results[key] > 0;
                }
            }
            cb(err, result);
        });
    };

    /**
     * Gets the total counts of a username and email in both the user and unverified_user collections
     *
     * @method getExistingUsernameEmailCounts
     * @param {String}   username
     * @param {String}   email
     * @param {String}   id       User object Id to exclude from the search
     * @param {Function} cb       Callback function
     */
    UserService.prototype.getExistingUsernameEmailCounts = function(username, email, id, cb) {
        if (util.isFunction(id)) {
            cb = id;
            id = null;
        }

        var getWhere = function(where) {
            if (id) {
                where[pb.DAO.getIdField()] = pb.DAO.getNotIDField(id);
            }
            return where;
        };
        var dao   = new pb.DAO();
        var tasks = {
            verified_username: function(callback) {
                var expStr = util.escapeRegExp(username) + '$';
                dao.count('user', getWhere({username: new RegExp(expStr, 'i')}), callback);
            },
            verified_email: function(callback) {
                dao.count('user', getWhere({email: email.toLowerCase()}), callback);
            },
            unverified_username: function(callback) {
                dao.count('unverified_user', getWhere({username: new RegExp(username + '$', 'i')}), callback);
            },
            unverified_email: function(callback) {
                dao.count('unverified_user', getWhere({email: email.toLowerCase()}), callback);
            },
        };
        async.series(tasks, cb);
    };

    /**
     * Retrieves users by their access level (role)
     * @method findByAccessLevel
     * @param {Integer} level The admin level of the users to find
     * @param {Object} [options] The search options
     * @param {Object} [options.select={}] The fields to return
     * @param {Array} [options.orderBy] The order to return the results in
     * @param {Integer} [options.limit] The maximum number of results to return
     * @param {offset} [options.offset=0] The number of results to skip before
     * returning results.
     * @param {Function} cb A callback that takes two parameters: an error, if
     * occurred, and the second is an array of User objects.
     */
    UserService.prototype.findByAccessLevel = function(level, options, cb) {
        if (util.isFunction(options)) {
            cb      = options;
            options = {};
        }
        else if (!util.isObject(options)) {
            throw new Error('The options parameter must be an object');
        }

        var opts = {
            select: options.select,
            where: {
                admin: level
            },
            order: options.orderBy,
            limit: options.limit,
            offset: options.offset
        };
        var dao = new pb.DAO();
        dao.q('user', opts, cb);
    };

    /**
     * Verifies if a user has the provided access level or higher
     *
     * @method hasAccessLevel
     * @param {String}   uid         The user's object Id
     * @param {Number}   accessLevel The access level to test against
     * @param {Function} cb          Callback function
     */
    UserService.prototype.hasAccessLevel = function(uid, accessLevel, cb) {
        var where = pb.DAO.getIdWhere(uid);
        where.admin = {$gte: accessLevel};
        var dao = new pb.DAO();
        dao.count('user', where, function(err, count) {
            cb(err, count === 1);
        });
    };
    return UserService;
};
